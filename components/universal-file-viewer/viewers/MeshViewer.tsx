import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { getExtension, ViewerProps } from '../types';

// Default material for meshes that don't carry their own vertex colors (typical of raw .stl scans).
const DEFAULT_RESIN_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xe8dcc8,
  roughness: 0.45,
  metalness: 0.05,
});

function frameObject(object: THREE.Object3D, camera: THREE.PerspectiveCamera, controls: OrbitControls) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fitDistance = maxDim / (2 * Math.tan((Math.PI * camera.fov) / 360));

  camera.position.copy(center).add(new THREE.Vector3(fitDistance, fitDistance * 0.6, fitDistance));
  camera.near = maxDim / 100;
  camera.far = maxDim * 100;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}

export const MeshViewer: React.FC<ViewerProps> = ({ source, fileName, onProgress, onReady, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationId: number;
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f1ea);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.9));
    // Headlamp-style key light: repositioned every frame to match the camera, so whichever
    // side faces the viewer is always the lit side, regardless of how the mesh is orbited.
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    scene.add(keyLight);
    scene.add(keyLight.target);
    // Soft fill light from the opposite side so the unlit side isn't pitch black.
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    scene.add(fillLight);
    scene.add(fillLight.target);

    const resolveSource = async (): Promise<string> => {
      if (typeof source === 'string') return source;
      return URL.createObjectURL(source);
    };

    const loadMesh = async () => {
      onProgress({ percent: 0, stage: 'Preparando arquivo' });
      const url = await resolveSource();
      const ext = getExtension(fileName);

      const onLoadProgress = (event: ProgressEvent) => {
        if (event.lengthComputable) {
          onProgress({ percent: (event.loaded / event.total) * 100, stage: 'Carregando malha' });
        } else {
          onProgress({ percent: -1, stage: 'Carregando malha' });
        }
      };

      try {
        let object3D: THREE.Object3D;

        if (ext === 'stl') {
          const geometry = await new STLLoader().loadAsync(url, onLoadProgress);
          geometry.computeVertexNormals();
          const hasColor = !!geometry.getAttribute('color');
          const mesh = new THREE.Mesh(
            geometry,
            hasColor
              ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 })
              : DEFAULT_RESIN_MATERIAL
          );
          object3D = mesh;
        } else if (ext === 'ply') {
          const geometry = await new PLYLoader().loadAsync(url, onLoadProgress);
          geometry.computeVertexNormals();
          const hasColor = !!geometry.getAttribute('color');
          const mesh = new THREE.Mesh(
            geometry,
            hasColor
              ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 })
              : DEFAULT_RESIN_MATERIAL.clone()
          );
          object3D = mesh;
        } else if (ext === 'obj') {
          const group = await new OBJLoader().loadAsync(url, onLoadProgress);
          group.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh && !child.material) {
              child.material = DEFAULT_RESIN_MATERIAL.clone();
            }
          });
          object3D = group;
        } else {
          throw new Error(`Extensão de malha não suportada: .${ext}`);
        }

        if (disposed) return;

        scene.add(object3D);
        frameObject(object3D, camera, controls);
        onProgress({ percent: 100, stage: 'Concluído' });
        onReady();
      } catch (err) {
        onError(err instanceof Error ? err : new Error('Falha ao carregar malha 3D'));
      } finally {
        if (typeof source !== 'string') URL.revokeObjectURL(url);
      }
    };

    loadMesh();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();

      // Keep the key light at the camera's position (headlamp) and the fill light on the
      // opposite side, both aimed at whatever the orbit controls are currently centered on.
      keyLight.position.copy(camera.position);
      keyLight.target.position.copy(controls.target);
      keyLight.target.updateMatrixWorld();

      const oppositeDir = camera.position.clone().sub(controls.target).negate().add(controls.target);
      fillLight.position.copy(oppositeDir);
      fillLight.target.position.copy(controls.target);
      fillLight.target.updateMatrixWorld();

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, fileName]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />;
};
