import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * Syncs a user profile from Supabase metadata.
   */
  async syncUser(data: { id: string; email: string; name?: string; mobile?: string; avatarUrl?: string }) {
    const existing = await this.userRepository.findById(data.id);
    if (existing) {
      return this.userRepository.update(data.id, {
        name: data.name ?? existing.name,
        mobile: data.mobile ?? existing.mobile,
        avatarUrl: data.avatarUrl ?? existing.avatarUrl,
        updatedAt: new Date(),
      });
    }

    return this.userRepository.insert({
      id: data.id,
      email: data.email,
      name: data.name || null,
      mobile: data.mobile || null,
      avatarUrl: data.avatarUrl || null,
    });
  }

  /**
   * Retrieves active memberships list for the user profile.
   */
  async getUserMemberships(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User profile not found.');
    }

    const memberships = await this.userRepository.findUserMemberships(userId);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mobile: user.mobile,
        avatarUrl: user.avatarUrl,
      },
      memberships,
    };
  }

  /**
   * Find a user by email address. Used by dev-login endpoint.
   */
  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  /**
   * Returns all users. Used by dev-login picker.
   */
  async findAllUsers() {
    return this.userRepository.findAllActive();
  }
}

