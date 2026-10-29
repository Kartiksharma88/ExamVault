import { Role } from '@prisma/client';
import { CaslAbilityFactory } from '../src/auth/casl-ability.factory';

describe('CASL Permissions & Role Boundaries (Section 2 & Acceptance Criteria)', () => {
  const factory = new CaslAbilityFactory();

  describe('ADMIN Role', () => {
    const adminUser = { id: 'admin-1', role: Role.ADMIN };
    const ability = factory.createForUser(adminUser);

    it('can manage blueprints and generation requests', () => {
      expect(ability.can('propose', 'Blueprint')).toBe(true);
      expect(ability.can('approve', 'Blueprint')).toBe(true);
      expect(ability.can('propose', 'GenerationRequest')).toBe(true);
      expect(ability.can('approve', 'GenerationRequest')).toBe(true);
      expect(ability.can('generate', 'Paper')).toBe(true);
      expect(ability.can('cancel', 'Paper')).toBe(true);
    });

    it('CANNOT read question content', () => {
      expect(ability.can('read', 'PaperContent')).toBe(false);
    });

    it('can download released paper files (single exception)', () => {
      expect(ability.can('download', 'ReleasedPaperFiles')).toBe(true);
    });

    it('CANNOT submit or read key shares (Admin cannot act as custodian)', () => {
      expect(ability.can('submitShare', 'KeyShare')).toBe(false);
      expect(ability.can('read', 'KeyShare')).toBe(false);
    });
  });

  describe('CUSTODIAN Role', () => {
    const custodianUser = { id: 'custodian-1', role: Role.CUSTODIAN };
    const ability = factory.createForUser(custodianUser);

    it('can submit key shares and view paper metadata', () => {
      expect(ability.can('submitShare', 'KeyShare')).toBe(true);
      expect(ability.can('read', 'Paper')).toBe(true);
    });

    it('CANNOT read question content, download released files, or read sealed manifest', () => {
      expect(ability.can('read', 'PaperContent')).toBe(false);
      expect(ability.can('download', 'ReleasedPaperFiles')).toBe(false);
      expect(ability.can('read', 'SealedManifest')).toBe(false);
      expect(ability.can('read', 'RevealedSeed')).toBe(false);
    });

    it('CANNOT manage blueprints or generation requests', () => {
      expect(ability.can('propose', 'Blueprint')).toBe(false);
      expect(ability.can('approve', 'GenerationRequest')).toBe(false);
      expect(ability.can('generate', 'Paper')).toBe(false);
    });
  });

  describe('AUDITOR Role', () => {
    const auditorUser = { id: 'auditor-1', role: Role.AUDITOR };
    const ability = factory.createForUser(auditorUser);

    it('can read public manifests, audit events, sealed manifests, and revealed seeds', () => {
      expect(ability.can('read', 'PublicManifest')).toBe(true);
      expect(ability.can('read', 'AuditEvent')).toBe(true);
      expect(ability.can('read', 'Paper')).toBe(true);
      expect(ability.can('read', 'SealedManifest')).toBe(true);
      expect(ability.can('read', 'RevealedSeed')).toBe(true);
    });

    it('CANNOT read question content or download released paper files', () => {
      expect(ability.can('read', 'PaperContent')).toBe(false);
      expect(ability.can('download', 'ReleasedPaperFiles')).toBe(false);
    });

    it('CANNOT manage blueprints, custodian groups, or submit shares', () => {
      expect(ability.can('propose', 'Blueprint')).toBe(false);
      expect(ability.can('submitShare', 'KeyShare')).toBe(false);
    });
  });

  describe('EXAMINER, REVIEWER, MODERATOR Roles', () => {
    const contentRoles = [Role.EXAMINER, Role.REVIEWER, Role.MODERATOR];

    for (const role of contentRoles) {
      it(`blocks ${role} from any Step 4/5 paper generation or release capability`, () => {
        const user = { id: 'user-1', role };
        const ability = factory.createForUser(user);

        expect(ability.can('propose', 'Blueprint')).toBe(false);
        expect(ability.can('approve', 'GenerationRequest')).toBe(false);
        expect(ability.can('generate', 'Paper')).toBe(false);
        expect(ability.can('download', 'ReleasedPaperFiles')).toBe(false);
        expect(ability.can('submitShare', 'KeyShare')).toBe(false);
        expect(ability.can('read', 'SealedManifest')).toBe(false);
      });
    }
  });
});

