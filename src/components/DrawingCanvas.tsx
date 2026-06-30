import React, { useState, useRef } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, PanResponder } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Undo, Trash2 } from 'lucide-react-native';

interface DrawingPath {
  path: any; // SkPath type
  color: string;
  strokeWidth: number;
}

const COLORS = [
  '#2C3E50', // Dark Charcoal
  '#E74C3C', // Red
  '#3498DB', // Blue
  '#2ECC71', // Green
  '#F1C40F', // Yellow
  '#9B59B6', // Purple
];

const BRUSH_SIZES = [2, 4, 8, 12, 16];

export default function DrawingCanvas() {
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPathState] = useState<DrawingPath | null>(null);
  const [selectedColor, setSelectedColor] = useState('#2C3E50');
  const [selectedSize, setSelectedSize] = useState(4);
  const [, setTick] = useState(0); // 화면 렌더링 강제 트리거

  // PanResponder에서 가장 최신의 상태 값을 읽을 수 있도록 Ref 유지
  const currentPathRef = useRef<DrawingPath | null>(null);
  const selectedColorRef = useRef(selectedColor);
  const selectedSizeRef = useRef(selectedSize);

  selectedColorRef.current = selectedColor;
  selectedSizeRef.current = selectedSize;

  const setCurrentPath = (val: DrawingPath | null) => {
    currentPathRef.current = val;
    setCurrentPathState(val);
  };

  // 터치 제스처 인식을 위한 PanResponder 설정
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const skPath = Skia.Path.Make();
        skPath.moveTo(locationX, locationY);
        
        setCurrentPath({
          path: skPath,
          color: selectedColorRef.current,
          strokeWidth: selectedSizeRef.current,
        });
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (currentPathRef.current) {
          currentPathRef.current.path.lineTo(locationX, locationY);
          setTick((t) => t + 1); // 그리는 도중 실시간 프레임 렌더링
        }
      },
      onPanResponderRelease: () => {
        if (currentPathRef.current) {
          const finalPath = currentPathRef.current;
          setPaths((prev) => [...prev, finalPath]);
          setCurrentPath(null);
        }
      },
    })
  ).current;

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPath(null);
  };

  return (
    <View style={styles.container}>
      {/* 터치를 가로채서 Skia 캔버스에 그리는 제스처 영역 */}
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Canvas style={styles.canvas}>
          {paths.map((p, index) => (
            <Path
              key={index}
              path={p.path}
              color={p.color}
              style="stroke"
              strokeWidth={p.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
          {currentPath && (
            <Path
              path={currentPath.path}
              color={currentPath.color}
              style="stroke"
              strokeWidth={currentPath.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
        </Canvas>
      </View>

      {/* 캔버스 툴바 (오른쪽 상단 플로팅) */}
      <View style={styles.toolbar}>
        {/* 색상 선택 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setSelectedColor(c)}
              style={[
                styles.colorButton,
                { backgroundColor: c },
                selectedColor === c && styles.selectedColorButton,
              ]}
            />
          ))}
        </ScrollView>

        <View style={styles.divider} />

        {/* 선 두께 선택 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sizeScroll}>
          {BRUSH_SIZES.map((size) => (
            <Pressable
              key={size}
              onPress={() => setSelectedSize(size)}
              style={[
                styles.sizeButton,
                selectedSize === size && styles.selectedSizeButton,
              ]}
            >
              <Text style={[styles.sizeText, selectedSize === size && styles.selectedSizeText]}>
                {size}pt
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.divider} />

        {/* 도구 제어 */}
        <View style={styles.actionButtons}>
          <Pressable onPress={handleUndo} style={styles.iconButton}>
            <Undo size={20} color="#2C3E50" />
            <Text style={styles.iconLabel}>실행취소</Text>
          </Pressable>

          <Pressable onPress={handleClear} style={styles.iconButton}>
            <Trash2 size={20} color="#E74C3C" />
            <Text style={[styles.iconLabel, { color: '#E74C3C' }]}>비우기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  canvas: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  toolbar: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: '90%',
  },
  colorScroll: {
    flexGrow: 0,
    marginRight: 8,
  },
  colorButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  selectedColorButton: {
    transform: [{ scale: 1.2 }],
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  sizeScroll: {
    flexGrow: 0,
    marginRight: 8,
  },
  sizeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedSizeButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sizeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  selectedSizeText: {
    color: '#FFFFFF',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  iconLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
});
