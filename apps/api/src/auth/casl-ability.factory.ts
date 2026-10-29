import {
  AbilityBuilder,
  PureAbility,
  AbilityClass,
  Subject,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

export type Action =
  | 'manage'
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'propose'
  | 'approve'
  | 'generate'
  | 'submitShare'
  | 'download'
  | 'cancel';

export type AppSubjects =
  | 'all'
  | 'Blueprint'
  | 'CustodianGroup'
  | 'GenerationRequest'
  | 'Paper'
  | 'PaperContent'
  | 'ReleasedPaperFiles'
  | 'KeyShare'
  | 'PublicManifest'
  | 'SealedManifest'
  | 'RevealedSeed'
  | 'AuditEvent';

export type AppAbility = PureAbility<[Action, AppSubjects]>;
export const AppAbility = PureAbility as AbilityClass<AppAbility>;

export interface UserContext {
  id: string;
  role: Role;
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: UserContext): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(AppAbility);

    switch (user.role) {
      case Role.ADMIN:
        can(['create', 'read', 'update', 'propose', 'approve'], 'Blueprint');
        can(['create', 'read', 'update'], 'CustodianGroup');
        can(['create', 'read', 'propose', 'approve'], 'GenerationRequest');
        can(['generate', 'cancel', 'read'], 'Paper');
        can('read', 'PublicManifest');
        can('read', 'AuditEvent');

        // ADMIN cannot read unreleased or unapproved question content
        cannot('read', 'PaperContent');

        // Single Exception: Proposer or Approver admin may download released paper files
        can('download', 'ReleasedPaperFiles');

        // ADMIN cannot hold or submit key shares
        cannot('submitShare', 'KeyShare');
        cannot('read', 'KeyShare');
        break;

      case Role.CUSTODIAN:
        // CUSTODIAN can only view papers they are assigned to, and submit their own share
        can('read', 'Paper');
        can('submitShare', 'KeyShare');
        cannot('read', 'PaperContent');
        cannot('download', 'ReleasedPaperFiles');
        cannot('read', 'SealedManifest');
        cannot('read', 'RevealedSeed');
        cannot('manage', 'Blueprint');
        cannot('manage', 'GenerationRequest');
        cannot('manage', 'CustodianGroup');
        break;

      case Role.AUDITOR:
        can('read', 'PublicManifest');
        can('read', 'AuditEvent');
        can('read', 'Paper');
        can('read', 'SealedManifest');
        can('read', 'RevealedSeed');
        cannot('read', 'PaperContent');
        cannot('download', 'ReleasedPaperFiles');
        cannot('manage', 'Blueprint');
        cannot('manage', 'GenerationRequest');
        cannot('manage', 'CustodianGroup');
        cannot('submitShare', 'KeyShare');
        break;

      case Role.EXAMINER:
      case Role.REVIEWER:
      case Role.MODERATOR:
        // Content roles have zero access to Step 4/5 paper generation or release
        cannot('manage', 'Blueprint');
        cannot('manage', 'GenerationRequest');
        cannot('manage', 'Paper');
        cannot('manage', 'CustodianGroup');
        cannot('manage', 'KeyShare');
        cannot('download', 'ReleasedPaperFiles');
        cannot('read', 'SealedManifest');
        cannot('read', 'RevealedSeed');
        break;
    }

    return build();
  }
}

