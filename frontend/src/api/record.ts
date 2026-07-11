import request from '@/utils/request';
import type { Record, RecordQuery, RecordListResponse } from '@/types/record';

export function listRecords(query?: RecordQuery): Promise<RecordListResponse> {
    return request.get('/record/list.json', { params: query });
}

export function latestRecords(limit?: number): Promise<Record[]> {
    return request.get('/record/latest.json', { params: { limit } });
}

export function getRecord(id: number): Promise<Record> {
    return request.get(`/record/${id}`);
}

export function deleteRecord(id: number): Promise<void> {
    return request.delete(`/record/${id}`);
}

export function clearPayload(): Promise<{ cleared: number }> {
    return request.delete('/record/clear-payload');
}

export function clearAllRecords(): Promise<{ deleted: number }> {
    return request.delete('/record/clear-all');
}
