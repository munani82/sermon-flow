import React, { useState, useRef } from 'react';
import { View, StyleSheet, Pressable, Text, ScrollView, PanResponder, useColorScheme } from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { Undo, Trash2, Eraser } from 'lucide-react-native';

interface DrawingPath {
  d: string; 
  points: Array<{ x: number; y: number }>; // 실시간 지우개 덧칠 판단용 점 목록
  color: string;
  strokeWidth: number;
}

const COLORS = [
  '#2C3E50', // Dark Charcoal (maps to light gray in dark mode)
  '#E74C3C', // Red
  '#3498DB', // Blue
  '#2ECC71', // Green
  '#F1C40F', // Yellow
  '#9B59B6', // Purple
];

const BRUSH_SIZES = [0.5, 1, 2, 4, 8];

interface DrawingCanvasProps {
  isToolbarVisible?: boolean;
  isActive?: boolean;
  canvasMode: 'draw' | 'text';
  setCanvasMode: (mode: 'draw' | 'text') => void;
}

export default function DrawingCanvas({ 
  isToolbarVisible = true, 
  isActive = true,
  canvasMode,
  setCanvasMode 
}: DrawingCanvasProps) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPathState] = useState<DrawingPath | null>(null);
  const [selectedColor, setSelectedColor] = useState('#2C3E50');
  const [selectedSize, setSelectedSize] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // PanResponder 런타임용 레퍼런스
  const currentPathRef = useRef<DrawingPath | null>(null);
  const selectedColorRef = useRef(selectedColor);
  const selectedSizeRef = useRef(selectedSize);
  const isActiveRef = useRef(isActive);
  const canvasModeRef = useRef(canvasMode);

  selectedColorRef.current = selectedColor;
  selectedSizeRef.current = selectedSize;
  isActiveRef.current = isActive;
  canvasModeRef.current = canvasMode;

  const setCurrentPath = (val: DrawingPath | null) => {
    currentPathRef.current = val;
    setCurrentPathState(val);
  };

  // 다크모드 대응 브러시 색상
  const getStrokeColor = (color: string) => {
    if (isDarkMode && color === '#2C3E50') {
      return '#ECF0F1'; 
    }
    return color;
  };

  // 터치 응답 여부 판별 (그리기 모드일 때만 터치 수신)
  const shouldRespond = () => {
    return isActiveRef.current && canvasModeRef.current === 'draw';
  };

  // 실시간 터치 궤적 주변의 선들을 지우는 로직 (Scribble/Rub to Erase)
  const erasePathsNear = (x: number, y: number) => {
    setPaths((prevPaths) => {
      return prevPaths.filter((p) => {
        // 선의 점들 중 지우개 터치 좌표(x, y)와 20픽셀 이내로 인접한 점이 있는지 확인
        const isNear = p.points.some((pt) => {
          const dx = pt.x - x;
          const dy = pt.y - y;
          return dx * dx + dy * dy < 576; // 24 * 24 = 576 (약 24픽셀 반경 감지)
        });
        // 인접한 점이 하나라도 있다면 해당 선 전체를 지움 (필터링 아웃)
        return !isNear;
      });
    });
  };

  // 터치 제스처 인식을 위한 PanResponder 설정
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: shouldRespond,
      onStartShouldSetPanResponderCapture: shouldRespond,
      onMoveShouldSetPanResponder: shouldRespond,
      onMoveShouldSetPanResponderCapture: shouldRespond,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        
        if (selectedColorRef.current === 'eraser') {
          // 지우개 모드일 경우 즉각 덧칠 감지하여 지우기 시작
          erasePathsNear(locationX, locationY);
        } else {
          // 그리기 모드일 경우 선 생성
          setCurrentPath({
            d: `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`,
            points: [{ x: locationX, y: locationY }],
            color: selectedColorRef.current,
            strokeWidth: selectedSizeRef.current,
          });
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        
        if (selectedColorRef.current === 'eraser') {
          // 지우개 모드일 경우 터치 경로 주변 덧칠 감지 지우기
          erasePathsNear(locationX, locationY);
        } else {
          // 그리기 모드일 경우 터치 궤적 추가
          if (currentPathRef.current) {
            const newPoints = [...currentPathRef.current.points, { x: locationX, y: locationY }];
            const newD = `${currentPathRef.current.d} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
            setCurrentPath({
              ...currentPathRef.current,
              d: newD,
              points: newPoints,
            });
          }
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

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setDimensions({ width, height });
  };

  // 오늘 날짜 한글 출력 도우미
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const date = today.getDate();
    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const day = dayNames[today.getDay()];
    return `${year}년 ${month}월 ${date}일 ${day}`;
  };

  // 줄 노트(연습장) 가로선 배경 생성 헬퍼 (간격 넓힘: 34px)
  const renderNotepadLines = () => {
    const lines = [];
    const lineSpacing = 34; 
    const totalLines = Math.max(100, Math.ceil(dimensions.height / lineSpacing) * 2);
    const strokeColor = isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 122, 255, 0.12)';

    for (let i = 1; i < totalLines; i++) {
      lines.push(
        <Line
          key={`line-${i}`}
          x1={0}
          y1={i * lineSpacing}
          x2={dimensions.width}
          y2={i * lineSpacing}
          stroke={strokeColor}
          strokeWidth={1}
        />
      );
    }
    return lines;
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* 제스처 영역 */}
      <View 
        style={styles.canvasContainer} 
        {...panResponder.panHandlers}
        onLayout={handleLayout}
        pointerEvents={canvasMode === 'draw' ? 'auto' : 'none'}
      >
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Svg style={{ width: dimensions.width, height: dimensions.height }} pointerEvents="none">
            {/* 1. 연습장 줄 노트 렌더링 */}
            {renderNotepadLines()}

            {/* 2. 맨 윗칸 오늘 날짜 렌더링 */}
            <SvgText
              x={20}
              y={24}
              fill={isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 122, 255, 0.45)'}
              fontSize={13}
              fontWeight="bold"
            >
              {getTodayDateString()}
            </SvgText>

            {/* 3. 기 저장된 그리기 선들 */}
            {paths.map((p, index) => (
              <Path
                key={index}
                d={p.d}
                stroke={getStrokeColor(p.color)}
                strokeWidth={p.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* 4. 현재 실시간으로 그리고 있는 선 */}
            {currentPath && (
              <Path
                d={currentPath.d}
                stroke={getStrokeColor(currentPath.color)}
                strokeWidth={currentPath.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        )}
      </View>

      {/* 캔버스 툴바 (오른쪽 상단 플로팅) */}
      {isToolbarVisible && (
        <View style={[styles.toolbar, isDarkMode && styles.darkToolbar]}>
          {/* 색상 선택 + 지우개 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll} contentContainerStyle={styles.colorScrollContainer}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setSelectedColor(c)}
                disabled={canvasMode === 'text'}
                style={[
                  styles.colorButton,
                  { backgroundColor: c },
                  selectedColor === c && styles.selectedColorButton,
                  canvasMode === 'text' && { opacity: 0.3 }
                ]}
              />
            ))}

            {/* 실시간 쓱쓱 지우개 버튼 */}
            <Pressable
              onPress={() => setSelectedColor('eraser')}
              disabled={canvasMode === 'text'}
              style={[
                styles.eraserButton,
                isDarkMode && styles.darkEraserButton,
                selectedColor === 'eraser' && styles.selectedEraserButton,
                canvasMode === 'text' && { opacity: 0.3 }
              ]}
            >
              <Eraser size={15} color={selectedColor === 'eraser' ? '#FFFFFF' : (isDarkMode ? '#94A3B8' : '#475569')} />
            </Pressable>
          </ScrollView>

          <View style={styles.divider} />

          {/* 선 두께 선택 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sizeScroll}>
            {BRUSH_SIZES.map((size) => (
              <Pressable
                key={size}
                onPress={() => setSelectedSize(size)}
                disabled={canvasMode === 'text' || selectedColor === 'eraser'}
                style={[
                  styles.sizeButton,
                  isDarkMode && styles.darkSizeButton,
                  selectedSize === size && styles.selectedSizeButton,
                  (canvasMode === 'text' || selectedColor === 'eraser') && { opacity: 0.3 }
                ]}
              >
                <Text style={[
                  styles.sizeText, 
                  isDarkMode && { color: '#94A3B8' },
                  selectedSize === size && styles.selectedSizeText
                ]}>
                  {size}pt
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.divider} />

          {/* 도구 제어 */}
          <View style={styles.actionButtons}>
            <Pressable onPress={handleUndo} style={styles.iconButton}>
              <Undo size={20} color={isDarkMode ? '#94A3B8' : '#2C3E50'} />
              <Text style={[styles.iconLabel, isDarkMode && { color: '#94A3B8' }]}>실행취소</Text>
            </Pressable>

            <Pressable onPress={handleClear} style={styles.iconButton}>
              <Trash2 size={20} color="#E74C3C" />
              <Text style={[styles.iconLabel, { color: '#E74C3C' }]}>초기화</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  canvasContainer: {
    width: '100%',
    height: '100%',
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
    maxWidth: '95%',
  },
  darkToolbar: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderColor: '#334155',
    borderWidth: 1,
  },
  colorScroll: {
    flexGrow: 0,
    marginRight: 8,
  },
  colorScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  eraserButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkEraserButton: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  selectedEraserButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    transform: [{ scale: 1.2 }],
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
  darkSizeButton: {
    backgroundColor: '#334155',
    borderColor: '#475569',
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
