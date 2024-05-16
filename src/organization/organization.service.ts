import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async getOrganizations(page: number, limit: number, search?: string) {
    const where: Prisma.OrganizationWhereInput = search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              townCity: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {};

    const organizations = await this.prisma.organization.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        changes: true,
      },
    });

    const totalRecords = await this.prisma.organization.count({ where });

    return {
      data: organizations,
      totalRecords,
      currentPage: Number(page),
      totalPages: Math.ceil(totalRecords / limit),
    };
  }
}
