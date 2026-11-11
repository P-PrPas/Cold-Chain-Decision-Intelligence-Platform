import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"./tests/e2e",timeout:180000,expect:{timeout:30000},workers:1,use:{headless:true,trace:"retain-on-failure"},reporter:[["list"],["html",{open:"never"}]]});
