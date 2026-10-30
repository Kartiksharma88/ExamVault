"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ScreeningQueue_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreeningQueue = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const originality_service_1 = require("./originality.service");
const review_service_1 = require("../review/review.service");
const prisma_service_1 = require("../prisma/prisma.service");
const { PgBoss } = require('pg-boss');
let ScreeningQueue = ScreeningQueue_1 = class ScreeningQueue {
    originalityService;
    prisma;
    config;
    reviewService;
    logger = new common_1.Logger(ScreeningQueue_1.name);
    boss = null;
    pollInterval = null;
    isProcessing = false;
    constructor(originalityService, prisma, config, reviewService) {
        this.originalityService = originalityService;
        this.prisma = prisma;
        this.config = config;
        this.reviewService = reviewService;
    }
    async onModuleInit() {
        if (process.env.VERCEL) {
            this.logger.log('Vercel serverless environment: skipping background screening queue runner');
            return;
        }
        const dbUrl = this.config.get('DATABASE_URL_UNPOOLED') || this.config.get('DATABASE_URL');
        if (dbUrl) {
            try {
                this.boss = new PgBoss({
                    connectionString: dbUrl,
                    schema: 'pgboss',
                    application_name: 'examvault_screening_worker',
                    max: 4,
                });
                this.boss.on('error', (err) => {
                    this.logger.warn(`PgBoss error (using internal runner): ${err.message}`);
                });
                await this.boss.start();
                try {
                    await this.boss.createQueue('screen-question');
                }
                catch (e) { }
                await this.boss.work('screen-question', async (job) => {
                    const { versionId } = job.data;
                    this.logger.log(`Processing screening job for version: ${versionId}`);
                    await this.originalityService.screenQuestion(versionId);
                });
                this.logger.log('PgBoss screening worker active and listening on queue "screen-question"');
            }
            catch (err) {
                this.logger.warn(`PgBoss start deferred (${err.message}). Starting robust internal polling worker.`);
                this.startInternalRunner();
            }
        }
        else {
            this.startInternalRunner();
        }
    }
    async onModuleDestroy() {
        if (this.pollInterval)
            clearInterval(this.pollInterval);
        if (this.boss) {
            try {
                await this.boss.stop();
            }
            catch (e) { }
        }
    }
    /**
     * Enqueue a screening job for a newly submitted question version
     */
    async enqueue(versionId) {
        if (this.boss) {
            try {
                await this.boss.send('screen-question', { versionId }, { retryLimit: 3, retryDelay: 10 });
                return;
            }
            catch (e) {
                this.logger.warn(`PgBoss send failed (${e.message}), executing screening directly.`);
            }
        }
        // Async direct execution fallback
        setImmediate(() => {
            this.originalityService.screenQuestion(versionId).catch((err) => {
                this.logger.error(`Direct screening failed for ${versionId}: ${err.message}`);
            });
        });
    }
    /**
     * Robust background fallback runner that picks up uncompleted screening tasks
     */
    startInternalRunner() {
        if (this.pollInterval)
            return;
        this.pollInterval = setInterval(async () => {
            if (this.isProcessing)
                return;
            this.isProcessing = true;
            try {
                // Look for any versions stuck in SUBMITTED or SCREENING for > 15 seconds
                const pending = await this.prisma.questionVersion.findMany({
                    where: {
                        status: { in: ['SUBMITTED', 'SCREENING'] },
                    },
                    take: 3,
                });
                for (const v of pending) {
                    try {
                        await this.originalityService.screenQuestion(v.id);
                    }
                    catch (e) {
                        this.logger.warn(`Worker screening attempt failed for ${v.id}: ${e.message}`);
                    }
                }
                // Also check for any questions in READY_FOR_REVIEW that don't have review rounds yet
                const unassigned = await this.prisma.questionVersion.findMany({
                    where: {
                        status: 'READY_FOR_REVIEW',
                        reviewRounds: { none: {} },
                    },
                    take: 3,
                });
                for (const u of unassigned) {
                    try {
                        await this.reviewService.assignReviewers(u.id);
                    }
                    catch (e) {
                        this.logger.warn(`Worker review assignment failed for ${u.id}: ${e.message}`);
                    }
                }
            }
            catch (err) { }
            finally {
                this.isProcessing = false;
            }
        }, 10000);
    }
};
exports.ScreeningQueue = ScreeningQueue;
exports.ScreeningQueue = ScreeningQueue = ScreeningQueue_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => review_service_1.ReviewService))),
    __metadata("design:paramtypes", [originality_service_1.OriginalityService,
        prisma_service_1.PrismaService,
        config_1.ConfigService,
        review_service_1.ReviewService])
], ScreeningQueue);
//# sourceMappingURL=screening.queue.js.map