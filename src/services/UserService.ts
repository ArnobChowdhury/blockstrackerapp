import { db } from '../db';
import { UserRepository, User } from '../db/repository/UserRepository';

export class UserService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository(db);
  }

  async getUserById(
    userId: string,
  ): Promise<Pick<User, 'id' | 'email' | 'isPremium'> | null> {
    return this.userRepo.getUserById(userId);
  }

  /**
   * Saves the user's profile data to the local database after a successful login.
   * @param user The user data received from the backend.
   */
  async saveUserLocally(
    user: Pick<User, 'id' | 'email' | 'isPremium'>,
  ): Promise<void> {
    try {
      console.log(`[UserService] Saving user ${user.id} to local database.`);
      await this.userRepo.upsertUser(user);
    } catch (error) {
      console.error(
        `[UserService] Failed to save user ${user.id} locally.`,
        error,
      );
      throw error;
    }
  }
}
