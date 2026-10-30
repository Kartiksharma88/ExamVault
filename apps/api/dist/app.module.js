"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const syllabus_module_1 = require("./syllabus/syllabus.module");
const crypto_module_1 = require("./crypto/crypto.module");
const questions_module_1 = require("./questions/questions.module");
const audit_module_1 = require("./audit/audit.module");
const import_module_1 = require("./import/import.module");
const stats_module_1 = require("./stats/stats.module");
const policies_module_1 = require("./policies/policies.module");
const originality_module_1 = require("./originality/originality.module");
const review_module_1 = require("./review/review.module");
const moderation_module_1 = require("./moderation/moderation.module");
const corpus_module_1 = require("./corpus/corpus.module");
const conflicts_module_1 = require("./conflicts/conflicts.module");
const internal_module_1 = require("./internal/internal.module");
const blueprints_module_1 = require("./blueprints/blueprints.module");
const custodians_module_1 = require("./custodians/custodians.module");
const generation_module_1 = require("./generation/generation.module");
const release_module_1 = require("./release/release.module");
const health_controller_1 = require("./health.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '../../.env',
            }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    name: 'general',
                    ttl: 60000,
                    limit: parseInt(process.env.RATE_LIMIT_GENERAL || '100', 10),
                },
            ]),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            syllabus_module_1.SyllabusModule,
            crypto_module_1.CryptoModule,
            questions_module_1.QuestionsModule,
            audit_module_1.AuditModule,
            import_module_1.ImportModule,
            stats_module_1.StatsModule,
            policies_module_1.PoliciesModule,
            originality_module_1.OriginalityModule,
            review_module_1.ReviewModule,
            moderation_module_1.ModerationModule,
            corpus_module_1.CorpusModule,
            conflicts_module_1.ConflictsModule,
            internal_module_1.InternalModule,
            blueprints_module_1.BlueprintsModule,
            custodians_module_1.CustodiansModule,
            generation_module_1.GenerationModule,
            release_module_1.ReleaseModule,
        ],
        controllers: [health_controller_1.HealthController],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map