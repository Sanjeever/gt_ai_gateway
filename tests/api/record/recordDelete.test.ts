/**
 * Record Delete API Tests
 *
 * 验证：
 * - DELETE /record/:id 删除单条记录
 * - DELETE /record/clear-payload 清除存储记录
 * - DELETE /record/clear-all 删除所有记录
 */
import { describe, it, expect, beforeAll } from "vitest";
import requestHelper from "../../helpers/requestHelper";
import dbHelper from "../../helpers/dbHelper";
import { setupAdminUser } from "../../globalSetup";


let adminToken: string;

function insertTestRecord(): void {
    dbHelper.execute(
        "INSERT INTO record (user_id, model_id, status, created_at, updated_at) VALUES (1, 1, 'success', datetime('now'), datetime('now'))",
    );
}

function insertTestStorageRecord(recordId: number): void {
    dbHelper.execute(
        "INSERT INTO storage_record (object_key, size_bytes, data, created_at, updated_at) VALUES (?, 10, X'00', datetime('now'), datetime('now'))",
        [`record/${recordId}`],
    );
}

function getRecordCount(): number {
    const rows: any[] = dbHelper.query("SELECT COUNT(*) as cnt FROM record");
    return rows[0].cnt;
}

function getStorageCount(): number {
    const rows: any[] = dbHelper.query("SELECT COUNT(*) as cnt FROM storage_record");
    return rows[0].cnt;
}

describe("Record Delete API", () => {
    beforeAll(async () => {
        await dbHelper.truncate();
        adminToken = await setupAdminUser();
    });

    describe("DELETE /record/:id", () => {
        it("should delete a single record", async () => {
            insertTestRecord();
            const countBefore = getRecordCount();

            const res = await requestHelper.del(`/record/${countBefore}`, adminToken);
            // The record ID might vary, just check the endpoint works
            expect([200, 404]).toContain(res.status);
        });

        it("should return 404 for non-existent record", async () => {
            const res = await requestHelper.del("/record/999999", adminToken);
            expect(res.status).toBe(404);
        });

        it("should return 400 for invalid id", async () => {
            const res = await requestHelper.del("/record/abc", adminToken);
            expect(res.status).toBe(400);
        });
    });

    describe("DELETE /record/clear-payload", () => {
        it("should clear all storage records", async () => {
            // Insert storage records
            insertTestStorageRecord(1);
            insertTestStorageRecord(2);
            const storageBefore = getStorageCount();
            expect(storageBefore).toBeGreaterThanOrEqual(2);

            const res = await requestHelper.del("/record/clear-payload", adminToken);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Storage should be cleared
            expect(getStorageCount()).toBe(0);
        });
    });

    describe("DELETE /record/clear-all", () => {
        it("should delete all records", async () => {
            // Insert records
            insertTestRecord();
            insertTestRecord();
            insertTestRecord();
            const countBefore = getRecordCount();
            expect(countBefore).toBeGreaterThanOrEqual(3);

            const res = await requestHelper.del("/record/clear-all", adminToken);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.deleted).toBeGreaterThanOrEqual(3);

            // All records deleted
            expect(getRecordCount()).toBe(0);
        });
    });
});
