/** CSci-4611 Example Code
 * Copyright 2023+ Regents of the University of Minnesota
 * Please do not distribute beyond the CSci-4611 course
 */

/* Lecture 14
 * CSCI 4611, Spring 2023, University of Minnesota
 * Instructor: Evan Suma Rosenberg <suma@umn.edu>
 * License: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
 */ 

import * as gfx from 'gophergfx'
import { GUI } from 'dat.gui'

export class ExampleApp extends gfx.GfxApp
{
    private cameraControls: gfx.OrbitControls;
    private skybox: gfx.Mesh3;
    private axes: gfx.Line3;
    private terrain: gfx.MorphMesh3;

    constructor()
    {
        super();

        this.cameraControls = new gfx.OrbitControls(this.camera);
        this.skybox = gfx.Geometry3Factory.createBox(1000, 1000, 500);
        this.axes = gfx.Geometry3Factory.createAxes(20);
        this.terrain = new gfx.MorphMesh3();
    }

    createScene(): void 
    {
        // Setup camera
        this.camera.setPerspectiveCamera(60, 1920/1080, 1, 1000)
        this.cameraControls.setOrbit(-Math.PI/4, 0);
        this.cameraControls.setDistance(230);
        
        // Create an ambient light
        const ambientLight = new gfx.AmbientLight(new gfx.Color(0.25, 0.25, 0.25));
        this.scene.add(ambientLight);

        // Create a directional light
        const directionalLight = new gfx.DirectionalLight(new gfx.Color(0.75, 0.75, 0.75));
        directionalLight.position.set(1, 1, 1)
        this.scene.add(directionalLight);

        // Set the skybox material
        this.skybox.material = new gfx.UnlitMaterial();
        this.skybox.material.setColor(new gfx.Color(0.698, 1, 1));
        this.skybox.material.side = gfx.Side.BACK;
        this.scene.add(this.skybox);

        // Add the axes to the scene
        this.axes.position.set(0, 0.1, 0);
        this.scene.add(this.axes);

        // Generate the terrain
        const width = 300;
        const depth = 200;
        const cols = 30;
        const rows = 20;
        const textureTiling = 5;
        this.terrain.material.texture = new gfx.Texture('./assets/sand.jpg');
        this.generateTerrain(width, depth, cols, rows, textureTiling);
        this.scene.add(this.terrain);

        // Create a simple GUI
        const gui = new GUI();
        gui.width = 200;

        const morphController = gui.add(this.terrain, 'morphAlpha', 0, 1);
        morphController.name('Alpha');

        const wireframeController = gui.add(this.terrain.material, 'wireframe');
        wireframeController.name('Wireframe');
    }

    update(deltaTime: number): void 
    {
        this.cameraControls.update(deltaTime);
    }

    private generateTerrain(width: number, depth: number, cols: number, rows: number, textureTiling: number): void
    {
        // First we generate a flat grid mesh
        const vertices: gfx.Vector3[] = [];
        const normals: gfx.Vector3[] = [];
        const indices: number[] = [];
        const uvs: number[] = [];

        // Compute vertices and normals
        for(let r=0; r < rows; r++)
        {
            for(let c=0; c < cols; c++)
            {
                const x = c / (cols-1) * width;
                const z = r / (rows-1) * depth;

                vertices.push(new gfx.Vector3(x - width/2, 0, z - depth/2));
                normals.push(new gfx.Vector3(0, 1, 0));
                uvs.push(textureTiling * x / width, textureTiling * z / depth);
            }
        }

        // Compute indices
        for(let r=0; r < rows-1; r++)
        {
            for(let c=0; c < cols-1; c++)
            {
                const upperLeftIndex = cols * r + c;
                const upperRightIndex = upperLeftIndex + 1;
                const lowerLeftIndex = upperLeftIndex + cols;
                const lowerRightIndex = lowerLeftIndex + 1;

                indices.push(upperLeftIndex, lowerLeftIndex, upperRightIndex);
                indices.push(upperRightIndex, lowerLeftIndex, lowerRightIndex);
            }
        }

        // Initialize the morph target vertices
        const morphVertices: gfx.Vector3[] = [];
        for(let i=0; i < vertices.length; i++)
            morphVertices.push(vertices[i].clone());

        // Generate terrain by displacing the height of the vertices
        for(let i=0; i < 100; i++)
            this.generateHillOrValley(morphVertices);

        // Compute the normals for the displaced surface
        const morphNormals = this.computeVertexNormals(morphVertices, indices);

        // Assign the data to the mesh buffers in GPU memory
        this.terrain.setVertices(vertices);
        this.terrain.setNormals(normals);
        this.terrain.setTextureCoordinates(uvs);
        this.terrain.createDefaultVertexColors();
        this.terrain.setIndices(indices);
        this.terrain.setMorphTargetVertices(morphVertices);
        this.terrain.setMorphTargetNormals(morphNormals);
        
    }

    private generateHillOrValley(vertices: gfx.Vector3[]): void
    {
        const centerIndex = Math.round(Math.random() * (vertices.length - 1));
        const centerPosition = vertices[centerIndex].clone();
        const radius = Math.random() * 50 + 20;
        const height = Math.random() * 50 - 25;

        // As this number gets closer to zero, the peaks will get more spiky
        const spikiness = 0.1;

        for(let i=0; i < vertices.length; i++)
        {
            let distanceFactor = centerPosition.distanceTo(vertices[i]) / radius;
            distanceFactor = gfx.MathUtils.clamp(distanceFactor, spikiness, distanceFactor);
            vertices[i].y += (1 / Math.exp(distanceFactor)) * height;
        }
    }

    private computeVertexNormals(vertices: gfx.Vector3[], indices: number[]): gfx.Vector3[]
    {
        // Initialize the vertex normals to zero
        const vertexNormals: gfx.Vector3[] = [];
        const vertexTriangleCount: number[] = [];
        for(let i=0; i < vertices.length; i++)
        {
            vertexNormals.push(new gfx.Vector3(0, 0, 0));
            vertexTriangleCount.push(0);
        }

        // Compute the normal for each triangle and add it to each vertex normal
        for(let i=0; i < indices.length; i+=3)
        {
            const v1 = vertices[indices[i]];
            const v2 = vertices[indices[i+1]];
            const v3 = vertices[indices[i+2]];

            const n1 = gfx.Vector3.subtract(v2, v1);
            const n2 = gfx.Vector3.subtract(v3, v1);

            n1.normalize();
            n2.normalize();

            const triangleNormal = gfx.Vector3.cross(n1, n2);

            vertexNormals[indices[i]].add(triangleNormal);
            vertexNormals[indices[i+1]].add(triangleNormal);
            vertexNormals[indices[i+2]].add(triangleNormal);

            vertexTriangleCount[indices[i]]++;
            vertexTriangleCount[indices[i+1]]++;
            vertexTriangleCount[indices[i+2]]++;
        }

        // Divide each vertex normal by the number of triangles to compute the average
        for(let i=0; i < vertexNormals.length; i++)
        {
            vertexNormals[i].multiplyScalar(1/vertexTriangleCount[i]);
        }
        
        return vertexNormals;
    }
}