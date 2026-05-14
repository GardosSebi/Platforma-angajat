import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import { JwtPayload } from "./jwt.strategy";

/** Narrow shape for login; matches Prisma `User` after `prisma generate`. */
type UserForLogin = {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  active: boolean;
  roles: string[];
};

type PrismaWithUser = {
  user: {
    findUnique(args: {
      where: { tenantId_email: { tenantId: string; email: string } };
    }): Promise<UserForLogin | null>;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async login(tenantId: string, email: string, password: string) {
    const db = this.prisma as unknown as PrismaWithUser;
    const user = await db.user.findUnique({
      where: {
        tenantId_email: { tenantId, email: email.toLowerCase() }
      }
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles: [...user.roles] as string[]
    };

    const accessToken = await this.jwt.signAsync(payload);

    const linkedEmployee = await this.prisma.employee.findFirst({
      where: {
        tenantId,
        active: true,
        email: { equals: user.email, mode: "insensitive" }
      },
      select: { id: true }
    });

    return {
      accessToken,
      expiresIn: "365d",
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roles: user.roles
      },
      linkedEmployeeId: linkedEmployee?.id ?? null
    };
  }
}
