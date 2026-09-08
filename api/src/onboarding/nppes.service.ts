import { Injectable, BadRequestException } from '@nestjs/common';

interface NppesResult {
  number: string;
  basic: {
    organization_name?: string;
    first_name?: string;
    last_name?: string;
    credential?: string;
    name_prefix?: string;
  };
  taxonomies?: Array<{
    code: string;
    desc: string;
    primary: boolean;
    state?: string;
    license?: string;
  }>;
  addresses?: Array<{
    address_1: string;
    city: string;
    state: string;
    postal_code: string;
    telephone_number?: string;
    fax_number?: string;
  }>;
  enumeration_type: 'NPI-1' | 'NPI-2'; // NPI-1 = individual, NPI-2 = organization
}

interface NppesResponse {
  result_count: number;
  results: NppesResult[];
}

export interface NpiVerificationResult {
  valid: boolean;
  npi: string;
  type: 'individual' | 'organization';
  name: string;
  credentials?: string;
  specialty?: string;
  taxonomyCode?: string;
  licenseNumber?: string;
  licenseState?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  phone?: string;
  fax?: string;
}

@Injectable()
export class NppesService {
  private readonly baseUrl = 'https://npiregistry.cms.hhs.gov/api';

  async verifyNpi(npi: string): Promise<NpiVerificationResult> {
    if (!/^\d{10}$/.test(npi)) {
      throw new BadRequestException('NPI must be exactly 10 digits');
    }

    const url = `${this.baseUrl}/?number=${npi}&version=2.1`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`NPPES API returned ${response.status}`);
      }

      const data: NppesResponse = await response.json();

      if (data.result_count === 0) {
        return { valid: false, npi, type: 'individual', name: '' };
      }

      const result = data.results[0];
      const isOrganization = result.enumeration_type === 'NPI-2';
      const primaryTaxonomy = result.taxonomies?.find((t) => t.primary);
      const primaryAddress = result.addresses?.[0];

      let name: string;
      if (isOrganization) {
        name = result.basic.organization_name || '';
      } else {
        const prefix = result.basic.name_prefix ? `${result.basic.name_prefix} ` : '';
        name = `${prefix}${result.basic.first_name || ''} ${result.basic.last_name || ''}`.trim();
      }

      return {
        valid: true,
        npi,
        type: isOrganization ? 'organization' : 'individual',
        name,
        credentials: result.basic.credential || undefined,
        specialty: primaryTaxonomy?.desc,
        taxonomyCode: primaryTaxonomy?.code,
        licenseNumber: primaryTaxonomy?.license,
        licenseState: primaryTaxonomy?.state,
        address: primaryAddress
          ? {
              street: primaryAddress.address_1,
              city: primaryAddress.city,
              state: primaryAddress.state,
              zip: primaryAddress.postal_code,
            }
          : undefined,
        phone: primaryAddress?.telephone_number?.replace(/\D/g, ''),
        fax: primaryAddress?.fax_number?.replace(/\D/g, ''),
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to verify NPI: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
