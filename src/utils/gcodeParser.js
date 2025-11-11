// Gcode 파싱 유틸리티

export function parseGcode(gcodeText) {
  const lines = gcodeText.split('\n');
  const paths = [];
  const moves = [];
  
  let currentPos = { x: 0, y: 0, z: 0, e: 0 };
  let absoluteMode = true; // G90 = absolute, G91 = relative
  let lastMoveType = null;
  
  lines.forEach((line, lineIndex) => {
    // 주석 제거
    line = line.split(';')[0].trim();
    if (!line) return;
    
    // 명령어 파싱
    const parts = line.split(' ');
    const command = parts[0].toUpperCase();
    
    // 좌표 추출
    const getCoord = (axis) => {
      const part = parts.find(p => p.toUpperCase().startsWith(axis));
      return part ? parseFloat(part.substring(1)) : null;
    };
    
    switch (command) {
      case 'G90':
        absoluteMode = true;
        break;
        
      case 'G91':
        absoluteMode = false;
        break;
        
      case 'G0': // 빠른 이동
      case 'G1': { // 직선 이동
        const x = getCoord('X');
        const y = getCoord('Y');
        const z = getCoord('Z');
        const e = getCoord('E');
        
        const newPos = { ...currentPos };
        
        if (absoluteMode) {
          if (x !== null) newPos.x = x;
          if (y !== null) newPos.y = y;
          if (z !== null) newPos.z = z;
          if (e !== null) newPos.e = e;
        } else {
          if (x !== null) newPos.x += x;
          if (y !== null) newPos.y += y;
          if (z !== null) newPos.z += z;
          if (e !== null) newPos.e += e;
        }
        
        // 경로 추가 (실제로 필라멘트를 압출하는 경우만)
        const isExtrusion = e !== null && newPos.e > currentPos.e;
        
        moves.push({
          from: { ...currentPos },
          to: { ...newPos },
          type: command,
          isExtrusion,
          lineNumber: lineIndex + 1,
          command: line
        });
        
        if (isExtrusion) {
          paths.push({
            from: { ...currentPos },
            to: { ...newPos },
            type: command,
            lineNumber: lineIndex + 1
          });
        }
        
        currentPos = newPos;
        lastMoveType = command;
        break;
      }
      
      case 'G28': // 홈 포지션
        currentPos = { x: 0, y: 0, z: 0, e: currentPos.e };
        break;
        
      case 'G92': { // 현재 위치 설정
        const x = getCoord('X');
        const y = getCoord('Y');
        const z = getCoord('Z');
        const e = getCoord('E');
        
        if (x !== null) currentPos.x = x;
        if (y !== null) currentPos.y = y;
        if (z !== null) currentPos.z = z;
        if (e !== null) currentPos.e = e;
        break;
      }
    }
  });
  
  return { paths, moves };
}

export function calculateBounds(paths) {
  if (paths.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }
  
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  paths.forEach(path => {
    [path.from, path.to].forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      minZ = Math.min(minZ, pos.z);
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
      maxZ = Math.max(maxZ, pos.z);
    });
  });
  
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ }
  };
}

export function getStatistics(paths, moves) {
  const layers = new Set();
  let totalDistance = 0;
  let extrusionDistance = 0;
  
  paths.forEach(path => {
    layers.add(path.from.z);
    layers.add(path.to.z);
    
    const dx = path.to.x - path.from.x;
    const dy = path.to.y - path.from.y;
    const dz = path.to.z - path.from.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    totalDistance += distance;
    extrusionDistance += distance;
  });
  
  moves.forEach(move => {
    if (!move.isExtrusion) {
      const dx = move.to.x - move.from.x;
      const dy = move.to.y - move.from.y;
      const dz = move.to.z - move.from.z;
      totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  });
  
  return {
    layerCount: layers.size,
    totalMoves: moves.length,
    extrusionMoves: paths.length,
    travelMoves: moves.length - paths.length,
    totalDistance: totalDistance.toFixed(2),
    extrusionDistance: extrusionDistance.toFixed(2)
  };
}
