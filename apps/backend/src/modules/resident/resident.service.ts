import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { ResidentRepository } from './resident.repository';
import { VotePollDto } from './dto/vote-poll.dto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  auditLogs, 
  visitors, 
  pollVotes 
} from '../../../database/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class ResidentService {
  constructor(
    private readonly residentRepository: ResidentRepository,
    @Inject(DRIZZLE_PROVIDER) private readonly db: DrizzleDB,
  ) {}

  /**
   * Compiles resident self-service summary.
   */
  async getDashboard(userId: string) {
    const flatContext = await this.residentRepository.findResidentFlatDetails(userId);
    if (!flatContext || !flatContext.flatId) {
      throw new NotFoundException('No flat association found for this user context.');
    }

    const outstanding = await this.residentRepository.getOutstandingDues(flatContext.flatId);
    const visitorsList = await this.residentRepository.getVisitorsLog(flatContext.flatId);
    const vehiclesList = await this.residentRepository.getVehiclesLog(flatContext.flatId);
    const activePolls = await this.residentRepository.getActivePolls();

    return {
      flatId: flatContext.flatId,
      memberId: flatContext.memberId,
      role: flatContext.role,
      outstanding,
      visitorsCount: visitorsList.length,
      visitors: visitorsList,
      vehicles: vehiclesList,
      polls: activePolls,
    };
  }

  /**
   * Approves/denies visitor pre-authorization checkpoints.
   */
  async approveVisitor(userId: string, visitorId: string, approve: boolean, executorId?: string) {
    const flatContext = await this.residentRepository.findResidentFlatDetails(userId);
    if (!flatContext || !flatContext.flatId) {
      throw new NotFoundException('Flat association context not resolved.');
    }

    const visitor = await this.db.query.visitors.findFirst({
      where: eq(visitors.id, visitorId),
    });

    if (!visitor || visitor.flatId !== flatContext.flatId) {
      throw new NotFoundException('Visitor record not found.');
    }

    const nextStatus = approve ? 'APPROVED' : 'DENIED';

    await this.db
      .update(visitors)
      .set({ status: nextStatus })
      .where(eq(visitors.id, visitorId));

    await this.logAction({
      societyId: this.clsTenantId,
      userId: executorId,
      action: 'VISITOR_APPROVAL_TOGGLE',
      entityName: 'visitors',
      entityId: visitorId,
      newValues: { status: nextStatus },
    });

    return { success: true, status: nextStatus };
  }

  /**
   * Casts balloting choices inside active society polls.
   */
  async votePoll(userId: string, pollId: string, dto: VotePollDto, executorId?: string) {
    const flatContext = await this.residentRepository.findResidentFlatDetails(userId);
    if (!flatContext || !flatContext.memberId) {
      throw new NotFoundException('Member registration context not found.');
    }

    const hasVoted = await this.residentRepository.checkHasVoted(pollId, flatContext.memberId);
    if (hasVoted) {
      throw new BadRequestException('You have already casted a vote for this resolution.');
    }

    const newVotes = await this.db.insert(pollVotes).values({
      id: require('crypto').randomUUID(),
      pollId,
      memberId: flatContext.memberId,
      choice: dto.choice,
    }).returning();

    await this.logAction({
      societyId: this.clsTenantId,
      userId: executorId,
      action: 'POLL_VOTE_CAST',
      entityName: 'poll_votes',
      entityId: newVotes[0].id,
      newValues: newVotes[0],
    });

    return { success: true };
  }

  private get clsTenantId() {
    // Resolve dynamically from the active request context
    return this.residentRepository['activeTenantId'];
  }

  private async logAction(data: {
    societyId?: string;
    userId?: string;
    action: string;
    entityName: string;
    entityId?: string;
    oldValues?: any;
    newValues?: any;
  }) {
    try {
      await this.db.insert(auditLogs).values({
        societyId: data.societyId || null,
        userId: data.userId || null,
        action: data.action,
        entityName: data.entityName,
        entityId: data.entityId || null,
        oldValues: data.oldValues || null,
        newValues: data.newValues || null,
      });
    } catch (err) {
      console.error('Failed to log audit action:', err);
    }
  }
}
