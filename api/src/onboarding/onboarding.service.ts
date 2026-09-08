import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClinicStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NppesService } from './nppes.service';

interface SignBaaDto {
  clinicId: string;
  signatoryName: string;
  signatoryTitle: string;
  signatoryEmail: string;
  ipAddress?: string;
}

interface UpdateClinicProfileDto {
  name?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  phone?: string;
  fax?: string;
  email?: string;
  npi?: string;
  taxId?: string;
  timezone?: string;
}

interface UpdateUserProfileDto {
  name?: string;
  credentials?: string;
  title?: string;
  specialty?: string;
  individualNpi?: string;
  licenseNumber?: string;
  licenseState?: string;
}

interface CompleteHipaaTrainingDto {
  attestationText?: string;
  ipAddress?: string;
}

const BAA_VERSION = '1.0.0';

const HIPAA_ATTESTATION_TEXT = `I acknowledge that I have received and reviewed the HIPAA Privacy and Security training materials. I understand my responsibilities regarding the protection of Protected Health Information (PHI) and agree to comply with all applicable HIPAA regulations and the organization's privacy and security policies.`;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nppesService: NppesService,
  ) {}

  async signBaa(cognitoSub: string, dto: SignBaaDto) {
    const user = await this.prisma.user.findUnique({ where: { cognitoSub } });
    if (!user || user.clinicId !== dto.clinicId) {
      throw new ForbiddenException('Not authorized to sign BAA for this clinic');
    }
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only owners and admins can sign the BAA');
    }

    const clinic = await this.prisma.clinic.findUnique({ where: { id: dto.clinicId } });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const existingBaa = await this.prisma.baaSignature.findFirst({
      where: { clinicId: dto.clinicId },
      orderBy: { signedAt: 'desc' },
    });
    if (existingBaa) {
      throw new BadRequestException('BAA has already been signed for this clinic');
    }

    const [baaSignature] = await this.prisma.$transaction([
      this.prisma.baaSignature.create({
        data: {
          clinicId: dto.clinicId,
          signatoryName: dto.signatoryName,
          signatoryTitle: dto.signatoryTitle,
          signatoryEmail: dto.signatoryEmail,
          signedAt: new Date(),
          ipAddress: dto.ipAddress,
          baaVersion: BAA_VERSION,
          signedByUserId: user.id,
        },
      }),
      this.prisma.clinic.update({
        where: { id: dto.clinicId },
        data: { status: ClinicStatus.PENDING_SETUP },
      }),
    ]);

    return baaSignature;
  }

  async updateClinicProfile(clinicId: string, cognitoSub: string, dto: UpdateClinicProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { cognitoSub } });
    if (!user || user.clinicId !== clinicId) {
      throw new ForbiddenException('Not authorized to update this clinic');
    }
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only owners and admins can update clinic settings');
    }

    // Verify NPI if provided
    if (dto.npi) {
      const npiResult = await this.nppesService.verifyNpi(dto.npi);
      if (!npiResult.valid) {
        throw new BadRequestException('Invalid organizational NPI');
      }
      if (npiResult.type !== 'organization') {
        throw new BadRequestException('This NPI is for an individual, not an organization. Use the clinic organizational NPI.');
      }
    }

    return this.prisma.clinic.update({
      where: { id: clinicId },
      data: {
        name: dto.name,
        addressStreet: dto.addressStreet,
        addressCity: dto.addressCity,
        addressState: dto.addressState,
        addressZip: dto.addressZip,
        phone: dto.phone,
        fax: dto.fax,
        email: dto.email,
        npi: dto.npi,
        taxId: dto.taxId,
        timezone: dto.timezone,
      },
    });
  }

  async uploadClinicLogo(clinicId: string, cognitoSub: string, logoUrl: string) {
    const user = await this.prisma.user.findUnique({ where: { cognitoSub } });
    if (!user || user.clinicId !== clinicId) {
      throw new ForbiddenException('Not authorized to update this clinic');
    }
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only owners and admins can update clinic logo');
    }

    return this.prisma.clinic.update({
      where: { id: clinicId },
      data: { logoUrl },
    });
  }

  async activateClinic(clinicId: string, cognitoSub: string) {
    const user = await this.prisma.user.findUnique({ where: { cognitoSub } });
    if (!user || user.clinicId !== clinicId) {
      throw new ForbiddenException('Not authorized to activate this clinic');
    }
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only owners and admins can activate the clinic');
    }

    const clinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      include: { baaSignatures: true },
    });

    if (!clinic) throw new NotFoundException('Clinic not found');
    if (clinic.baaSignatures.length === 0) {
      throw new BadRequestException('BAA must be signed before activating');
    }
    if (!clinic.name || !clinic.addressStreet || !clinic.addressCity || !clinic.addressState || !clinic.addressZip) {
      throw new BadRequestException('Clinic profile must be completed before activating');
    }

    // Check if activating user has completed their own onboarding
    if (!user.hipaaTrainingCompletedAt) {
      throw new BadRequestException('You must complete HIPAA training before activating the clinic');
    }

    return this.prisma.clinic.update({
      where: { id: clinicId },
      data: { status: ClinicStatus.ACTIVE },
    });
  }

  async updateUserProfile(cognitoSub: string, dto: UpdateUserProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { cognitoSub } });
    if (!user) throw new NotFoundException('User not found');

    // Verify individual NPI if provided
    if (dto.individualNpi) {
      const npiResult = await this.nppesService.verifyNpi(dto.individualNpi);
      if (!npiResult.valid) {
        throw new BadRequestException('Invalid individual NPI');
      }
      if (npiResult.type !== 'individual') {
        throw new BadRequestException('This NPI is for an organization, not an individual');
      }
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: dto.name,
        credentials: dto.credentials,
        title: dto.title,
        specialty: dto.specialty,
        individualNpi: dto.individualNpi,
        licenseNumber: dto.licenseNumber,
        licenseState: dto.licenseState,
      },
    });
  }

  async uploadSignature(cognitoSub: string, signatureUrl: string, signatureType: 'typed' | 'drawn' | 'uploaded') {
    const user = await this.prisma.user.findUnique({ where: { cognitoSub } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        signatureImageUrl: signatureUrl,
        signatureType,
      },
    });
  }

  async completeHipaaTraining(cognitoSub: string, dto: CompleteHipaaTrainingDto) {
    const user = await this.prisma.user.findUnique({ where: { cognitoSub } });
    if (!user) throw new NotFoundException('User not found');

    if (user.hipaaTrainingCompletedAt) {
      // Check if training needs refresher (1 year)
      const lastTraining = await this.prisma.hipaaTraining.findFirst({
        where: { userId: user.id },
        orderBy: { completedAt: 'desc' },
      });
      if (lastTraining && new Date() < lastTraining.expiresAt) {
        throw new BadRequestException('HIPAA training is still valid');
      }
    }

    const completedAt = new Date();
    const expiresAt = new Date(completedAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const [training] = await this.prisma.$transaction([
      this.prisma.hipaaTraining.create({
        data: {
          userId: user.id,
          trainingType: user.hipaaTrainingCompletedAt ? 'annual_refresher' : 'initial',
          completedAt,
          expiresAt,
          attestationText: dto.attestationText || HIPAA_ATTESTATION_TEXT,
          ipAddress: dto.ipAddress,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { hipaaTrainingCompletedAt: completedAt },
      }),
    ]);

    return training;
  }

  async completeOnboarding(cognitoSub: string) {
    const user = await this.prisma.user.findUnique({
      where: { cognitoSub },
      include: { clinic: { include: { baaSignatures: true } } },
    });
    if (!user) throw new NotFoundException('User not found');

    // Check all requirements for a clinician to be fully onboarded
    const issues: string[] = [];

    if (!user.hipaaTrainingCompletedAt) {
      issues.push('HIPAA training not completed');
    }
    if (user.role === 'CLINICIAN' || user.role === 'OWNER') {
      if (!user.credentials) issues.push('Credentials not set');
      if (!user.signatureImageUrl) issues.push('Digital signature not uploaded');
    }

    if (issues.length > 0) {
      throw new BadRequestException(`Onboarding incomplete: ${issues.join(', ')}`);
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: { onboardingComplete: true },
    });
  }

  async getOnboardingStatus(cognitoSub: string) {
    const user = await this.prisma.user.findUnique({
      where: { cognitoSub },
      include: {
        clinic: {
          include: { baaSignatures: { orderBy: { signedAt: 'desc' }, take: 1 } },
        },
        hipaaTrainingRecords: { orderBy: { completedAt: 'desc' }, take: 1 },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const clinic = user.clinic;
    const latestBaa = clinic.baaSignatures[0];
    const latestTraining = user.hipaaTrainingRecords[0];

    return {
      clinic: {
        status: clinic.status,
        baaSigned: !!latestBaa,
        baaSignedAt: latestBaa?.signedAt,
        profileComplete: !!(
          clinic.name &&
          clinic.addressStreet &&
          clinic.addressCity &&
          clinic.addressState &&
          clinic.addressZip
        ),
        hasLogo: !!clinic.logoUrl,
      },
      user: {
        onboardingComplete: user.onboardingComplete,
        hipaaTrainingComplete: !!user.hipaaTrainingCompletedAt,
        hipaaTrainingExpiresAt: latestTraining?.expiresAt,
        hasCredentials: !!user.credentials,
        hasSignature: !!user.signatureImageUrl,
        hasNpi: !!user.individualNpi,
      },
    };
  }

  async verifyNpi(npi: string) {
    return this.nppesService.verifyNpi(npi);
  }
}
