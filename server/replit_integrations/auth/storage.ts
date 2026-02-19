import { users, type User, type UpsertUser } from "../../../shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const insertData = {
      id: userData.id || crypto.randomUUID(),
      username: userData.username,
      password: userData.password,
      role: userData.role,
      email: userData.email,
    };
    
    const [user] = await db
      .insert(users)
      .values(insertData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: userData.username,
          password: userData.password,
          role: userData.role,
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
