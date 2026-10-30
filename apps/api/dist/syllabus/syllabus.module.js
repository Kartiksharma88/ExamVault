"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyllabusModule = void 0;
const common_1 = require("@nestjs/common");
const syllabus_service_1 = require("./syllabus.service");
const syllabus_controller_1 = require("./syllabus.controller");
let SyllabusModule = class SyllabusModule {
};
exports.SyllabusModule = SyllabusModule;
exports.SyllabusModule = SyllabusModule = __decorate([
    (0, common_1.Module)({
        controllers: [syllabus_controller_1.SyllabusController],
        providers: [syllabus_service_1.SyllabusService],
        exports: [syllabus_service_1.SyllabusService],
    })
], SyllabusModule);
//# sourceMappingURL=syllabus.module.js.map