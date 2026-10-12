import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

const USER_ID = 'user-uuid-001';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  media: {
    findUnique: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(mockPrisma as any);
  });

  describe('findById', () => {
    it('returns user if found and not deleted', async () => {
      const user = { id: USER_ID, name: 'আসিফ', email: 'asif@example.com' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findById(USER_ID);
      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: USER_ID, deletedAt: null },
        select: expect.any(Object),
      });
    });

    it('throws NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById(USER_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('successfully updates user name with trimmed value', async () => {
      const updatedUser = {
        id: USER_ID,
        name: 'হাজী মো. আবুল হোসেন',
        email: 'owner@example.com',
      };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(USER_ID, {
        name: '  হাজী মো. আবুল হোসেন  ',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { name: 'হাজী মো. আবুল হোসেন' },
        select: expect.any(Object),
      });
      expect(result).toEqual(updatedUser);
    });

    it('throws BadRequestException if name is only whitespace', async () => {
      await expect(
        service.updateProfile(USER_ID, { name: '   ' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
