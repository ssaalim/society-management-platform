import { Test, TestingModule } from '@nestjs/testing';
import { SocietyService } from './society.service';
import { SocietyRepository } from './society.repository';
import { DRIZZLE_PROVIDER } from '@core/database/database.module';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SocietyService', () => {
  let service: SocietyService;
  let repository: jest.Mocked<SocietyRepository>;
  let mockDb: any;

  const mockSociety = {
    id: 'f3914a5c-7d9a-4c22-b5e1-0c58a980753b',
    name: 'Gokuldham Society',
    slug: 'gokuldham',
    address: 'Powai, Mumbai',
    gstin: '27AAAAA1111A1Z1',
    pan: 'AAAAA1111A',
    tan: 'AAAA11111A',
    registrationNumber: 'REG-12345',
    registrationDate: '2020-01-01',
    renewalDate: '2025-01-01',
    logoUrl: null,
    registrationCertificateUrl: null,
    byeLawsUrl: null,
    bankPassbookUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockRepo = {
      insert: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
    };

    mockDb = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockResolvedValue([]),
    };

    const mockConfig = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://mock.supabase.co';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'mock-key';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocietyService,
        { provide: SocietyRepository, useValue: mockRepo },
        { provide: DRIZZLE_PROVIDER, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<SocietyService>(SocietyService);
    repository = module.get(SocietyRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should insert a new society and log the action', async () => {
      repository.findBySlug.mockResolvedValue(null as any);
      repository.insert.mockResolvedValue(mockSociety);

      const dto = {
        name: 'Gokuldham Society',
        slug: 'gokuldham',
        address: 'Powai, Mumbai',
        registrationNumber: 'REG-12345',
      };

      const result = await service.create(dto, 'user-123');

      expect(repository.findBySlug).toHaveBeenCalledWith('gokuldham');
      expect(repository.insert).toHaveBeenCalledWith(dto);
      expect(mockDb.insert).toHaveBeenCalled(); // Audit logging check
      expect(result).toEqual(mockSociety);
    });

    it('should throw BadRequestException if slug already exists', async () => {
      repository.findBySlug.mockResolvedValue(mockSociety);

      const dto = {
        name: 'Gokuldham Society',
        slug: 'gokuldham',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return society details if found', async () => {
      const mockDetails = { ...mockSociety, bankAccounts: [], committee: [] };
      (repository as any).findDetailsById = jest.fn().mockResolvedValue(mockDetails);

      const result = await service.findOne(mockSociety.id);

      expect(repository.findDetailsById).toHaveBeenCalledWith(mockSociety.id);
      expect(result).toEqual(mockDetails);
    });

    it('should throw NotFoundException if society is missing', async () => {
      (repository as any).findDetailsById = jest.fn().mockResolvedValue(null as any);

      await expect(service.findOne(mockSociety.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update society parameters and audit log it', async () => {
      repository.findById.mockResolvedValue(mockSociety);
      const updatedMock = { ...mockSociety, name: 'Gokuldham Co-Op' };
      repository.update.mockResolvedValue(updatedMock);

      const dto = { name: 'Gokuldham Co-Op' };
      const result = await service.update(mockSociety.id, dto, 'user-123');

      expect(repository.findById).toHaveBeenCalledWith(mockSociety.id);
      expect(repository.update).toHaveBeenCalledWith(mockSociety.id, {
        name: 'Gokuldham Co-Op',
        updatedAt: expect.any(Date),
      });
      expect(result.name).toBe('Gokuldham Co-Op');
    });

    it('should throw NotFoundException on updating non-existing profile', async () => {
      repository.findById.mockResolvedValue(null as any);

      await expect(service.update(mockSociety.id, { name: 'Gokuldham Co-Op' })).rejects.toThrow(NotFoundException);
    });
  });
});
