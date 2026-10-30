"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaslAbilityFactory = exports.AppAbility = void 0;
const ability_1 = require("@casl/ability");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
exports.AppAbility = ability_1.PureAbility;
let CaslAbilityFactory = class CaslAbilityFactory {
    createForUser(user) {
        const { can, cannot, build } = new ability_1.AbilityBuilder(exports.AppAbility);
        switch (user.role) {
            case client_1.Role.ADMIN:
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
            case client_1.Role.CUSTODIAN:
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
            case client_1.Role.AUDITOR:
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
            case client_1.Role.EXAMINER:
            case client_1.Role.REVIEWER:
            case client_1.Role.MODERATOR:
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
};
exports.CaslAbilityFactory = CaslAbilityFactory;
exports.CaslAbilityFactory = CaslAbilityFactory = __decorate([
    (0, common_1.Injectable)()
], CaslAbilityFactory);
//# sourceMappingURL=casl-ability.factory.js.map