import { describe, it, expect } from 'bun:test';
import { noise2D, fbm, perturbPoint } from './filters.js';

describe('filters.js', () => {
    describe('noise2D', () => {
        it('should be deterministic', () => {
            const x = 1.5;
            const y = 2.5;
            const val1 = noise2D(x, y);
            const val2 = noise2D(x, y);
            expect(val1).toBe(val2);
        });

        it('should return 0 at integer coordinates', () => {
            // Perlin noise is 0 at grid points
            expect(noise2D(1, 1)).toBe(0);
            expect(noise2D(10, 20)).toBe(0);
            expect(noise2D(-5, 5)).toBe(0);
        });

        it('should be continuous (small changes in input lead to small changes in output)', () => {
            const x = 0.5;
            const y = 0.5;
            const val1 = noise2D(x, y);
            const val2 = noise2D(x + 0.01, y);
            expect(Math.abs(val1 - val2)).toBeLessThan(0.1);
        });

        it('should stay within the range [-1, 1]', () => {
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * 1000;
                const y = Math.random() * 1000;
                const val = noise2D(x, y);
                expect(val).toBeGreaterThanOrEqual(-1);
                expect(val).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('fbm', () => {
        it('should stay within the range [-1, 1]', () => {
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * 1000;
                const y = Math.random() * 1000;
                const val = fbm(x, y, 4);
                expect(val).toBeGreaterThanOrEqual(-1);
                expect(val).toBeLessThanOrEqual(1);
            }
        });

        it('should be equivalent to noise2D with 1 octave', () => {
            const x = 0.7;
            const y = 0.3;
            expect(fbm(x, y, 1)).toBe(noise2D(x, y));
        });
    });

    describe('perturbPoint', () => {
        it('should return an object with x and y numeric properties', () => {
            const point = perturbPoint(10, 10);
            expect(typeof point.x).toBe('number');
            expect(typeof point.y).toBe('number');
        });

        it('should return identical point when magnitude is 0', () => {
            const x = 15;
            const y = 25;
            const point = perturbPoint(x, y, 10, 0);
            expect(point.x).toBe(x);
            expect(point.y).toBe(y);
        });

        it('should displace point when magnitude is non-zero', () => {
            const x = 15.123;
            const y = 25.456;
            const point = perturbPoint(x, y, 10, 5);
            // Use non-integer coordinates so noise2D doesn't return 0
            expect(point.x).not.toBe(x);
            expect(point.y).not.toBe(y);
        });
    });
});
