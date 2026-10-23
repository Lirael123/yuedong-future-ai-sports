import { useAnalysisStore } from '../../store/analysisStore';

export default function MetricsOverview() {
  const { referenceMetrics, userMetrics, manualMarkers, referenceVideo, userVideo } = useAnalysisStore();
  
  // Calculate comparison values
  const airTimeDiff = (userMetrics?.airTime && referenceMetrics?.airTime)
    ? userMetrics.airTime - referenceMetrics.airTime
    : null;
  
  const rotationsDiff = (userMetrics && userMetrics.rotations !== null && referenceMetrics && referenceMetrics.rotations !== null) 
    ? userMetrics.rotations - referenceMetrics.rotations 
    : null;
  
  const heightDiff = (userMetrics?.max高度（旧模块） && referenceMetrics?.max高度（旧模块）) 
    ? userMetrics.max高度（旧模块） - referenceMetrics.max高度（旧模块） 
    : null;

  const formatTime = (time: number | null) => {
    if (time === null) return '--';
    return `${time.toFixed(2)}s`;
  };

  const format旋转圈数（旧模块） = (rotations: number | null) => {
    if (rotations === null) return '--';
    return rotations.toFixed(1);
  };

  const format高度（旧模块） = (height: number | null) => {
    if (height === null) return '--';
    return `${(height * 100).toFixed(0)}cm`; // Convert meters to cm
  };

  const formatDiff = (diff: number | null, unit: string, decimals: number = 2) => {
    if (diff === null) return null;
    const sign = diff > 0 ? '+' : '';
    if (unit === 'cm') {
      return `${sign}${(diff * 100).toFixed(0)}${unit}`;
    }
    return `${sign}${diff.toFixed(decimals)}${unit}`;
  };

  const getChangeClass = (diff: number | null) => {
    if (diff === null) return '';
    return diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400';
  };

  // Only show metrics if we have manual markers and both videos
  if (!manualMarkers || !userMetrics || !referenceVideo || !userVideo) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📊</span>
          <span className="text-white text-base font-semibold">动作分析</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">腾空时间</div>
            <div className="text-white text-2xl font-bold">--</div>
          </div>
          <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">旋转圈数（旧模块）</div>
            <div className="text-white text-2xl font-bold">--</div>
          </div>
          <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">高度（旧模块）</div>
            <div className="text-white text-2xl font-bold">--</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📊</span>
        <span className="text-white text-base font-semibold">动作分析</span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {/* 腾空时间 */}
        <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
          <div className="text-gray-400 text-xs mb-1">腾空时间</div>
          <div className="text-white text-xl font-bold">
            {formatTime(userMetrics.airTime)}
          </div>
          {airTimeDiff !== null && (
            <div className={`text-xs mt-1 font-semibold ${getChangeClass(airTimeDiff)}`}>
              {formatDiff(airTimeDiff, 's')}
            </div>
          )}
        </div>

        {/* 旋转圈数（旧模块） */}
        <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
          <div className="text-gray-400 text-xs mb-1">旋转圈数（旧模块）</div>
          <div className="text-white text-xl font-bold">
            {format旋转圈数（旧模块）(userMetrics.rotations)}
          </div>
          {rotationsDiff !== null && (
            <div className={`text-xs mt-1 font-semibold ${getChangeClass(rotationsDiff)}`}>
              {formatDiff(rotationsDiff, '', 1)}
            </div>
          )}
        </div>

        {/* 高度（旧模块） */}
        <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
          <div className="text-gray-400 text-xs mb-1">高度（旧模块）</div>
          <div className="text-white text-xl font-bold">
            {format高度（旧模块）(userMetrics.max高度（旧模块）)}
          </div>
          {heightDiff !== null && (
            <div className={`text-xs mt-1 font-semibold ${getChangeClass(heightDiff)}`}>
              {formatDiff(heightDiff, 'cm')}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}