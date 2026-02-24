import { describe, it, expect } from 'vitest';
import { parseOperationsCsv, getCsvTemplate, estimateOpDetails } from '../../services/dataService';

describe('Data Service', () => {
    
    describe('CSV Parsing', () => {
        it('should parse valid CSV with operations', () => {
            const csv = `Datum;Saal;Zeit;Fach;Eingriff
03.12.2025;1;08:00;UCH;Knie-TEP
03.12.2025;2;09:00;ACH;Appendektomie`;

            const result = parseOperationsCsv(csv);

            expect(result['03.12.2025']).toBeDefined();
            expect(result['03.12.2025']).toHaveLength(2);
            expect(result['03.12.2025'][0].procedure).toBe('Knie-TEP');
            expect(result['03.12.2025'][0].dept).toBe('UCH');
        });

        it('should handle multiple dates', () => {
            const csv = `Datum;Saal;Zeit;Fach;Eingriff
03.12.2025;1;08:00;UCH;Operation 1
04.12.2025;2;09:00;ACH;Operation 2`;

            const result = parseOperationsCsv(csv);

            expect(Object.keys(result)).toHaveLength(2);
            expect(result['03.12.2025']).toHaveLength(1);
            expect(result['04.12.2025']).toHaveLength(1);
        });

        it('should throw error for invalid CSV format', () => {
            const invalidCsv = `Invalid;Format
Data;Here`;

            expect(() => parseOperationsCsv(invalidCsv)).toThrow();
        });

        it('should handle empty lines', () => {
            const csv = `Datum;Saal;Zeit;Fach;Eingriff
03.12.2025;1;08:00;UCH;Operation

03.12.2025;2;09:00;ACH;Operation 2`;

            const result = parseOperationsCsv(csv);
            expect(result['03.12.2025']).toHaveLength(2);
        });

        it('should map room numbers to SAAL format', () => {
            const csv = `Datum;Saal;Zeit;Fach;Eingriff
03.12.2025;1;08:00;UCH;Test`;

            const result = parseOperationsCsv(csv);
            expect(result['03.12.2025'][0].room).toBe('SAAL 1');
        });

        it('should validate required columns', () => {
            const missingColumn = `Datum;Saal;Zeit
03.12.2025;1;08:00`;

            expect(() => parseOperationsCsv(missingColumn)).toThrow();
        });
    });

    describe('CSV Template', () => {
        it('should generate valid CSV template', () => {
            const template = getCsvTemplate();

            expect(template).toContain('Datum');
            expect(template).toContain('SAAL');
        });

        it('should include example data', () => {
            const template = getCsvTemplate();

            expect(template.split('\n').length).toBeGreaterThan(1);
        });
    });

    describe('Operation Details Estimation', () => {
        it('should estimate TEP as high priority', () => {
            const details = estimateOpDetails('Knie-TEP');

            expect(details.priority).toBe('HIGH');
            expect(details.revenue).toBeGreaterThan(5000);
            expect(details.duration).toBeGreaterThan(60);
        });

        it('should estimate hernia as medium priority', () => {
            const details = estimateOpDetails('Hernie');

            expect(details.priority).toBe('MEDIUM');
            expect(details.duration).toBeGreaterThan(0);
        });

        it('should handle unknown procedures with defaults', () => {
            const details = estimateOpDetails('Unknown Procedure');

            expect(details.priority).toBe('MEDIUM');
            expect(details.revenue).toBeGreaterThan(0);
            expect(details.duration).toBeGreaterThan(0);
        });

        it('should estimate spine surgery as high value', () => {
            const details = estimateOpDetails('Wirbelsäule');

            expect(details.priority).toBe('HIGH');
            expect(details.revenue).toBeGreaterThan(8000);
        });
    });

    describe('Department Code Mapping', () => {
        it('should handle department codes in CSV', () => {
            // Department mapping is handled internally by the CSV parser
            const csv = `Datum;Saal;Zeit;Fach;Eingriff\n03.12.2025;1;08:00;UCH;Test`;
            const result = parseOperationsCsv(csv);
            expect(result['03.12.2025'][0].dept).toBe('UCH');
        });
    });

    describe('Edge Cases', () => {
        it('should handle German umlauts in procedure names', () => {
            const csv = `Datum;Saal;Zeit;Fach;Eingriff
03.12.2025;1;08:00;UCH;Hüft-OP`;

            const result = parseOperationsCsv(csv);
            expect(result['03.12.2025'][0].procedure).toBe('Hüft-OP');
        });

        it('should handle times with different formats', () => {
            const csv = `Datum;Saal;Zeit;Fach;Eingriff
03.12.2025;1;8:00;UCH;Test
03.12.2025;2;14:30;ACH;Test2`;

            const result = parseOperationsCsv(csv);
            expect(result['03.12.2025']).toHaveLength(2);
        });
    });
});
