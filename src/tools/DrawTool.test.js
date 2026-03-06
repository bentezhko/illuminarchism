import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import DrawTool from "./DrawTool.js";
import HistoricalEntity from "../core/Entity.js";

describe("DrawTool", () => {
    let appMock;
    let tool;

    beforeEach(() => {
        // Mock the app object with required properties and methods
        appMock = {
            draftPoints: [],
            draftCursor: null,
            render: mock(() => {}),
            ontologyTaxonomy: {
                political: {
                    types: [
                        { value: 'nation-state', geometryType: 'Polygon' },
                        { value: 'city', geometryType: 'Point' },
                        { value: 'vassal', geometryType: 'Polygon' }
                    ]
                }
            },
            drawDomain: 'political',
            drawTypology: 'nation-state',
            drawSubtype: null,
            selectedEntityId: null,
            entitiesById: new Map(),
            entities: [],
            currentYear: 1000,
            newAreaCounter: 1,
            selectEntity: mock(() => {}),
            renderRegistry: mock(() => {}),
            updateInfoPanel: mock(() => {}),
            setActiveTool: mock(() => {}),
            toolbar: {
                selectTool: mock(() => {})
            }
        };

        tool = new DrawTool(appMock);

        // Mock Date.now() to return a predictable value for ID generation
        // But since we can't easily mock Date.now globally without affecting everything,
        // we'll use assertions that don't depend on the exact timestamp
    });

    describe("addPoint", () => {
        it("should add a point and call render", () => {
            tool.addPoint({ x: 10, y: 20 });
            expect(appMock.draftPoints.length).toBe(1);
            expect(appMock.draftPoints[0]).toEqual({ x: 10, y: 20 });
            expect(appMock.render).toHaveBeenCalledTimes(1);
        });

        it("should not add a point if it's too close to the last one", () => {
            tool.addPoint({ x: 10, y: 20 });
            appMock.render.mockClear();

            tool.addPoint({ x: 11, y: 21 }); // Distance is < 2

            expect(appMock.draftPoints.length).toBe(1);
            expect(appMock.render).not.toHaveBeenCalled();

            tool.addPoint({ x: 13, y: 23 }); // Distance is > 2
            expect(appMock.draftPoints.length).toBe(2);
            expect(appMock.render).toHaveBeenCalledTimes(1);
        });
    });

    describe("updateCursor", () => {
        it("should update draftCursor and call render", () => {
            tool.updateCursor({ x: 50, y: 60 });
            expect(appMock.draftCursor).toEqual({ x: 50, y: 60 });
            expect(appMock.render).toHaveBeenCalledTimes(1);
        });
    });

    describe("commit", () => {
        it("should return early if there are no draft points", () => {
            tool.commit();
            expect(appMock.entities.length).toBe(0);
        });

        it("should return early if not a point geometry and < 2 points", () => {
            appMock.draftPoints = [{ x: 10, y: 10 }];
            tool.commit();
            expect(appMock.entities.length).toBe(0);
        });

        it("should commit point geometry with 1 point", () => {
            appMock.drawTypology = 'city';
            appMock.draftPoints = [{ x: 10, y: 10 }];

            const randomSpy = spyOn(Math, 'random').mockImplementation(() => 0.5); // Will pick the middle color '#c5a059'
            const dateSpy = spyOn(Date, 'now').mockImplementation(() => 12345);

            try {
                tool.commit();

                expect(appMock.entities.length).toBe(1);
                const newEnt = appMock.entities[0];
                expect(newEnt.id).toBe('ent_12345');
                expect(newEnt.name).toBe('NewArea1');
                expect(newEnt.color).toBe('#c5a059');
                expect(newEnt.timeline[0].geometry).toEqual([{ x: 10, y: 10 }]);
                expect(appMock.selectEntity).toHaveBeenCalledWith('ent_12345');

                expect(appMock.draftPoints.length).toBe(0);
                expect(appMock.draftCursor).toBeNull();
                expect(appMock.toolbar.selectTool).toHaveBeenCalledWith('pan');
            } finally {
                randomSpy.mockRestore();
                dateSpy.mockRestore();
            }
        });

        it("should update existing entity if selectedEntityId is set", () => {
            const existingEnt = new HistoricalEntity('ent_1', 'Existing Area', {
                domain: 'political',
                typology: 'nation-state',
                color: '#ff0000'
            });
            existingEnt.validRange = { start: 900, end: 1100 };

            appMock.selectedEntityId = 'ent_1';
            appMock.entitiesById.set('ent_1', existingEnt);

            appMock.draftPoints = [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }];

            tool.commit();

            expect(existingEnt.timeline.length).toBe(1);
            expect(existingEnt.timeline[0].year).toBe(1000);
            expect(appMock.updateInfoPanel).toHaveBeenCalledWith(existingEnt);
            expect(appMock.draftPoints.length).toBe(0);
            expect(appMock.toolbar.selectTool).toHaveBeenCalledWith('pan');
        });

        it("should create a vassal if existing entity selected and typology is vassal", () => {
            const parentEnt = new HistoricalEntity('ent_1', 'Parent Area', {
                domain: 'political',
                typology: 'nation-state',
                color: '#ff0000'
            });

            appMock.selectedEntityId = 'ent_1';
            appMock.entitiesById.set('ent_1', parentEnt);
            appMock.drawTypology = 'vassal';

            appMock.draftPoints = [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }];

            tool.commit();

            expect(appMock.entities.length).toBe(1);
            const vassal = appMock.entities[0];
            expect(vassal.id).toMatch(/^vassal_/);
            expect(vassal.name).toBe('Parent Area (Sub)');
            expect(vassal.parentId).toBe('ent_1');
            expect(vassal.color).toBe('#ff0000');
            expect(vassal.validRange.start).toBe(1000);
            expect(vassal.validRange.end).toBe(1200);
            expect(appMock.selectEntity).toHaveBeenCalledWith(vassal.id);
            expect(appMock.renderRegistry).toHaveBeenCalledTimes(1);
        });

        it("should fallback to app.setActiveTool if app.toolbar is undefined", () => {
            appMock.toolbar = undefined;
            appMock.drawTypology = 'city';
            appMock.draftPoints = [{ x: 10, y: 10 }];

            tool.commit();

            expect(appMock.setActiveTool).toHaveBeenCalledWith('pan');
        });
    });

    describe("cancel", () => {
        it("should clear draft points and cursor and call render", () => {
            appMock.draftPoints = [{ x: 10, y: 10 }];
            appMock.draftCursor = { x: 20, y: 20 };

            tool.cancel();

            expect(appMock.draftPoints.length).toBe(0);
            expect(appMock.draftCursor).toBeNull();
            expect(appMock.render).toHaveBeenCalledTimes(1);
        });
    });
});
