import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { parseGcode, calculateBounds, getStatistics } from '../utils/gcodeParser';

export default function GcodeViewer() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const pathLinesRef = useRef([]);
  const animationFrameRef = useRef(null);
  
  const [gcodeData, setGcodeData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState(null);
  const [showTravelMoves, setShowTravelMoves] = useState(false);
  const [layerFilter, setLayerFilter] = useState({ min: 0, max: Infinity });

  // Three.js 씬 초기화
  useEffect(() => {
    if (!containerRef.current) return;

    // 씬 생성
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // 카메라 생성
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      10000
    );
    camera.position.set(200, 200, 200);
    cameraRef.current = camera;

    // 렌더러 생성
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 컨트롤 생성
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // 그리드 추가
    const gridHelper = new THREE.GridHelper(400, 40, 0x444444, 0x222222);
    scene.add(gridHelper);

    // 축 헬퍼 추가
    const axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    // 조명 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);

    // 애니메이션 루프
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 리사이즈 핸들러
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // 클린업
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Gcode 시각화
  useEffect(() => {
    if (!gcodeData || !sceneRef.current) return;

    // 기존 경로 제거
    pathLinesRef.current.forEach(line => {
      sceneRef.current.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    });
    pathLinesRef.current = [];

    const { paths, moves } = gcodeData;
    const bounds = calculateBounds(paths);
    const zRange = bounds.max.z - bounds.min.z;

    // 빌드 플레이트 추가
    const plateGeometry = new THREE.PlaneGeometry(
      bounds.max.x - bounds.min.x + 20,
      bounds.max.y - bounds.min.y + 20
    );
    const plateMaterial = new THREE.MeshBasicMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    });
    const plate = new THREE.Mesh(plateGeometry, plateMaterial);
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(
      (bounds.max.x + bounds.min.x) / 2,
      bounds.min.z - 0.1,
      (bounds.max.y + bounds.min.y) / 2
    );
    sceneRef.current.add(plate);
    pathLinesRef.current.push(plate);

    // 압출 경로 그리기
    paths.forEach((path, index) => {
      // 레이어 필터링
      if (path.from.z < layerFilter.min || path.from.z > layerFilter.max) return;

      const points = [
        new THREE.Vector3(path.from.x, path.from.z, path.from.y),
        new THREE.Vector3(path.to.x, path.to.z, path.to.y)
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      // Z 높이에 따라 색상 변경 (레이어별 색상)
      const colorValue = zRange > 0 ? (path.from.z - bounds.min.z) / zRange : 0;
      const color = new THREE.Color().setHSL(colorValue * 0.7, 1, 0.5);
      
      const material = new THREE.LineBasicMaterial({
        color: color,
        linewidth: 2,
        opacity: index <= currentFrame ? 1 : 0.1,
        transparent: true
      });

      const line = new THREE.Line(geometry, material);
      sceneRef.current.add(line);
      pathLinesRef.current.push(line);
    });

    // 이동 경로 그리기 (옵션)
    if (showTravelMoves) {
      moves.filter(m => !m.isExtrusion).forEach(move => {
        if (move.from.z < layerFilter.min || move.from.z > layerFilter.max) return;

        const points = [
          new THREE.Vector3(move.from.x, move.from.z, move.from.y),
          new THREE.Vector3(move.to.x, move.to.z, move.to.y)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
          color: 0x00ff00,
          linewidth: 1,
          opacity: 0.2,
          transparent: true
        });

        const line = new THREE.Line(geometry, material);
        sceneRef.current.add(line);
        pathLinesRef.current.push(line);
      });
    }

    // 카메라 위치 조정
    if (cameraRef.current) {
      const center = new THREE.Vector3(
        (bounds.max.x + bounds.min.x) / 2,
        (bounds.max.z + bounds.min.z) / 2,
        (bounds.max.y + bounds.min.y) / 2
      );
      
      const size = Math.max(
        bounds.max.x - bounds.min.x,
        bounds.max.y - bounds.min.y,
        bounds.max.z - bounds.min.z
      );
      
      const distance = size * 1.5;
      cameraRef.current.position.set(
        center.x + distance,
        center.y + distance,
        center.z + distance
      );
      
      if (controlsRef.current) {
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
    }
  }, [gcodeData, currentFrame, showTravelMoves, layerFilter]);

  // 애니메이션 재생
  useEffect(() => {
    if (!isPlaying || !gcodeData) return;

    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        if (prev >= gcodeData.paths.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + Math.max(1, Math.floor(speed));
      });
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [isPlaying, gcodeData, speed]);

  // 파일 업로드 핸들러
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseGcode(text);
      setGcodeData(parsed);
      setCurrentFrame(0);
      setIsPlaying(false);
      
      const statistics = getStatistics(parsed.paths, parsed.moves);
      setStats(statistics);
      
      // 레이어 필터 초기화
      const bounds = calculateBounds(parsed.paths);
      setLayerFilter({ min: bounds.min.z, max: bounds.max.z });
    };
    reader.readAsText(file);
  };

  const togglePlay = () => {
    if (currentFrame >= gcodeData.paths.length - 1) {
      setCurrentFrame(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentFrame(0);
    setIsPlaying(false);
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-900 text-white">
      {/* 헤더 */}
      <div className="bg-gray-800 p-4 shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Gcode 3D Viewer</h1>
        
        {/* 파일 업로드 */}
        <div className="mb-4">
          <input
            type="file"
            accept=".gcode,.nc,.txt"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-300
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-600 file:text-white
              hover:file:bg-blue-700 file:cursor-pointer"
          />
        </div>

        {/* 컨트롤 패널 */}
        {gcodeData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 재생 컨트롤 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold block">재생 컨트롤</label>
              <div className="flex gap-2">
                <button
                  onClick={togglePlay}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
                >
                  {isPlaying ? '일시정지' : '재생'}
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-semibold"
                >
                  리셋
                </button>
              </div>
            </div>

            {/* 속도 조절 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold block">
                속도: {speed}x
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* 진행도 */}
            <div className="space-y-2">
              <label className="text-sm font-semibold block">
                진행도: {currentFrame} / {gcodeData.paths.length}
              </label>
              <input
                type="range"
                min="0"
                max={gcodeData.paths.length - 1}
                value={currentFrame}
                onChange={(e) => {
                  setCurrentFrame(Number(e.target.value));
                  setIsPlaying(false);
                }}
                className="w-full"
              />
            </div>

            {/* 옵션 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTravelMoves}
                  onChange={(e) => setShowTravelMoves(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">이동 경로 표시</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 3D 뷰어와 통계 */}
      <div className="flex-1 flex">
        {/* 3D 뷰어 */}
        <div ref={containerRef} className="flex-1" />

        {/* 통계 패널 */}
        {stats && (
          <div className="w-64 bg-gray-800 p-4 overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">통계</h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-gray-400">레이어 수</div>
                <div className="text-xl font-semibold">{stats.layerCount}</div>
              </div>
              <div>
                <div className="text-gray-400">총 이동</div>
                <div className="text-xl font-semibold">{stats.totalMoves}</div>
              </div>
              <div>
                <div className="text-gray-400">압출 이동</div>
                <div className="text-xl font-semibold text-green-400">{stats.extrusionMoves}</div>
              </div>
              <div>
                <div className="text-gray-400">단순 이동</div>
                <div className="text-xl font-semibold text-blue-400">{stats.travelMoves}</div>
              </div>
              <div>
                <div className="text-gray-400">총 이동 거리</div>
                <div className="text-xl font-semibold">{stats.totalDistance} mm</div>
              </div>
              <div>
                <div className="text-gray-400">압출 거리</div>
                <div className="text-xl font-semibold">{stats.extrusionDistance} mm</div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <h3 className="text-sm font-semibold mb-2">컨트롤 안내</h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• 마우스 드래그: 회전</li>
                <li>• 마우스 휠: 줌</li>
                <li>• 우클릭 드래그: 이동</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
