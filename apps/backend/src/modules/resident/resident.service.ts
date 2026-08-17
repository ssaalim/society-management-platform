import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { ResidentRepository } from './resident.repository';
import { VotePollDto } from './dto/vote-poll.dto';
import { DRIZZLE_PROVIDER, DrizzleDB } from '@core/database/database.module';
import { 
  auditLogs, 
  visitors, 
  pollVotes 
} from '../../../database/schema';
import { eq } from 'drizzle-orm';

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
    const flatId = flatContext?.flatId || '';
    const memberId = flatContext?.memberId || '';

    const outstanding = flatId ? await this.residentRepository.getOutstandingDues(flatId) : 0;
    const visitorsList = flatId ? await this.residentRepository.getVisitorsLog(flatId) : [];
    const vehiclesList = flatId ? await this.residentRepository.getVehiclesLog(flatId) : [];
    const documentsList = await this.residentRepository.getDocuments();
    const activePolls = await this.residentRepository.getActivePolls(memberId);

    return {
      flatId: flatContext?.flatId || null,
      flatNumber: flatContext?.flatNumber || null,
      memberId: flatContext?.memberId || null,
      role: flatContext?.role || 'OWNER',
      outstanding,
      visitorsCount: visitorsList.length,
      visitors: visitorsList,
      vehicles: vehiclesList,
      documents: documentsList,
      polls: activePolls,
    };
  }

  // ==========================================
  // VEHICLES
  // ==========================================

  async getVehicles(userId: string) {
    const flatContext = await this.residentRepository.findResidentFlatDetails(userId);
    if (!flatContext || !flatContext.flatId) {
      return this.residentRepository.getAllSocietyVehicles();
    }
    return this.residentRepository.getVehiclesLog(flatContext.flatId);
  }

  async addVehicle(userId: string, data: { number: string; type: string; make?: string; model?: string; flatId?: string }) {
    let flatId = data.flatId;
    if (!flatId) {
      const flatContext = await this.residentRepository.findResidentFlatDetails(userId);
      if (!flatContext || !flatContext.flatId) {
        throw new BadRequestException('Please specify flat for vehicle registration or ensure your account is assigned to a flat.');
      }
      flatId = flatContext.flatId;
    }

    const vehicle = await this.residentRepository.addVehicle({
      flatId,
      number: data.number,
      type: data.type,
      make: data.make,
      model: data.model,
    });

    await this.logAction({
      societyId: this.clsTenantId,
      userId,
      action: 'VEHICLE_REGISTERED',
      entityName: 'vehicles',
      entityId: vehicle.id,
      newValues: vehicle,
    });

    return vehicle;
  }

  async deleteVehicle(userId: string, vehicleId: string) {
    const flatContext = await this.residentRepository.findResidentFlatDetails(userId);
    const flatId = ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY'].includes(flatContext?.role || '')
      ? undefined
      : (flatContext?.flatId || undefined);

    const res = await this.residentRepository.deleteVehicle(vehicleId, flatId);
    if (!res) {
      throw new NotFoundException('Vehicle record not found or not authorized to remove.');
    }

    await this.logAction({
      societyId: this.clsTenantId,
      userId,
      action: 'VEHICLE_REMOVED',
      entityName: 'vehicles',
      entityId: vehicleId,
    });

    return { success: true };
  }

  // ==========================================
  // CIRCULARS & SHARED DOCUMENTS
  // ==========================================

  async getDocuments() {
    return this.residentRepository.getDocuments();
  }

  async addDocument(userId: string, data: { name: string; category: string; fileUrl: string; fileSize?: number; isPrivate?: boolean }) {
    if (!data.name || !data.fileUrl) {
      throw new BadRequestException('Document title and file URL are required.');
    }

    const doc = await this.residentRepository.addDocument(data);

    await this.logAction({
      societyId: this.clsTenantId,
      userId,
      action: 'DOCUMENT_PUBLISHED',
      entityName: 'documents',
      entityId: doc.id,
      newValues: doc,
    });

    return doc;
  }

  async deleteDocument(userId: string, docId: string) {
    const res = await this.residentRepository.deleteDocument(docId);
    if (!res) {
      throw new NotFoundException('Document not found.');
    }

    await this.logAction({
      societyId: this.clsTenantId,
      userId,
      action: 'DOCUMENT_DELETED',
      entityName: 'documents',
      entityId: docId,
    });

    return { success: true };
  }

  // ==========================================
  // GENERAL BODY PROPOSALS & POLLS
  // ==========================================

  async getPolls(userId: string) {
    const flatContext = await this.residentRepository.findResidentFlatDetails(userId);
    return this.residentRepository.getActivePolls(flatContext?.memberId);
  }

  async createPoll(userId: string, data: { question: string; description?: string; endDate: string; status?: string }) {
    if (!data.question || !data.endDate) {
      throw new BadRequestException('Resolution question and end date are required.');
    }

    const poll = await this.residentRepository.createPoll(data);

    await this.logAction({
      societyId: this.clsTenantId,
      userId,
      action: 'POLL_CREATED',
      entityName: 'polls',
      entityId: poll.id,
      newValues: poll,
    });

    return poll;
  }

  async deletePoll(userId: string, pollId: string) {
    const res = await this.residentRepository.deletePoll(pollId);
    if (!res) {
      throw new NotFoundException('Poll record not found.');
    }

    await this.logAction({
      societyId: this.clsTenantId,
      userId,
      action: 'POLL_DELETED',
      entityName: 'polls',
      entityId: pollId,
    });

    return { success: true };
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
    const memberId = flatContext?.memberId;
    if (!memberId) {
      throw new NotFoundException('Member registration context not found for casting ballot.');
    }

    const hasVoted = await this.residentRepository.checkHasVoted(pollId, memberId);
    if (hasVoted) {
      throw new BadRequestException('You have already casted a vote for this resolution.');
    }

    const newVotes = await this.db.insert(pollVotes).values({
      id: require('crypto').randomUUID(),
      pollId,
      memberId,
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
