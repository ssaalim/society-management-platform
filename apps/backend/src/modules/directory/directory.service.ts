import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { sql } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';

type Occupancy = 'OWNER' | 'TENANT' | 'EMPTY';

interface Row {
  wingId: string | null;
  wingName: string | null;
  buildingName: string | null;
  floor: number | null;
  flatId: string;
  number: string;
  owners: string[] | null;
  tenants: string[] | null;
}

/**
 * The resident directory every member can see: wing, floor, flat number, who lives there (name only) and whether
 * the flat is owner-occupied, rented or empty. No phone numbers, emails or other details.
 */
@Injectable()
export class DirectoryService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
    private readonly cls: ClsService,
  ) {}

  private get societyId(): string {
    const id = this.cls.get<string>('tenantId');
    if (!id) throw new BadRequestException('Society context is missing.');
    return id;
  }

  async directory() {
    const rows = (await this.db.execute(sql`
      select w.id as "wingId", w.name as "wingName", b.name as "buildingName", fl.number as "floor", f.id as "flatId", f.number,
        (select array_agg(distinct u.name) from flat_owners fo join owners o on o.id = fo.owner_id join users u on u.id = o.user_id
          where fo.flat_id = f.id and fo.is_current) as "owners",
        (select array_agg(distinct u.name) from flat_tenants ft join tenants t on t.id = ft.tenant_id join users u on u.id = t.user_id
          where ft.flat_id = f.id and ft.is_active) as "tenants"
      from flats f
      left join floors fl on fl.id = f.floor_id
      left join wings w on w.id = fl.wing_id
      left join buildings b on b.id = w.building_id
      where f.society_id = ${this.societyId} and f.deleted_at is null
    `)) as unknown as Row[];

    const clean = (n: string) => n.replace(/\s*\(.*\)$/, '').trim();
    const wings = new Map<string, { id: string; name: string; buildingName: string | null; flats: any[] }>();
    for (const r of rows) {
      const key = r.wingId || 'none';
      if (!wings.has(key)) wings.set(key, { id: key, name: r.wingName || 'Flats', buildingName: r.buildingName, flats: [] });
      const owners = (r.owners || []).filter(Boolean).map(clean);
      const tenants = (r.tenants || []).filter(Boolean).map(clean);
      // Who lives there: tenants if it is rented out, otherwise the owners.
      const occupancy: Occupancy = tenants.length ? 'TENANT' : owners.length ? 'OWNER' : 'EMPTY';
      wings.get(key)!.flats.push({
        id: r.flatId,
        number: r.number,
        floor: r.floor,
        occupancy,
        residents: [...owners.map((name) => ({ name, kind: 'OWNER' })), ...tenants.map((name) => ({ name, kind: 'TENANT' }))],
      });
    }
    const byNum = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
    return [...wings.values()]
      .sort((a, b) => byNum(a.name, b.name))
      .map((w) => ({
        ...w,
        flatCount: w.flats.length,
        occupied: w.flats.filter((f) => f.occupancy !== 'EMPTY').length,
        flats: w.flats.sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0) || byNum(a.number, b.number)),
      }));
  }
}
