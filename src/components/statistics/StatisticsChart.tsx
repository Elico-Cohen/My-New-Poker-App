// src/components/statistics/StatisticsChart.tsx

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

// Define casino theme colors
const CASINO_COLORS = {
  gold: '#FFD700',
  primary: '#35654d',
  background: '#1C2C2E',
  text: '#FFFFFF',
  textSecondary: '#B8B8B8',
  success: '#22c55e',
  error: '#ef4444',
  info: '#3b82f6',
  warning: '#f59e0b',
  chartColors: [
    '#FFD700', // Gold
    '#22c55e', // Success green
    '#3b82f6', // Info blue
    '#f59e0b', // Warning orange
    '#ef4444', // Error red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#84cc16', // Lime
    '#a855f7', // Violet
  ]
};

const screenWidth = Dimensions.get('window').width - 32; // Account for padding

interface ChartDataset {
  data: number[];
  colors?: string[];
  strokeWidth?: number;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

interface StatisticsChartProps {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'stacked';
  data: ChartData;
  height?: number;
  width?: number;
  yAxisSuffix?: string;
  yAxisPrefix?: string;
  formatYLabel?: (label: string) => string;
  formatXLabel?: (label: string) => string;
  legend?: boolean;
  style?: any;
  showGrid?: boolean;
  showValues?: boolean;
  hideLegend?: boolean;
  horizontalLabels?: boolean;
}

const StatisticsChart: React.FC<StatisticsChartProps> = ({
  type,
  data,
  height = 220,
  width,
  yAxisSuffix = '',
  yAxisPrefix = '',
  formatYLabel,
  formatXLabel,
  legend = false,
  style,
  showGrid = true,
  showValues = false,
  hideLegend = false,
  horizontalLabels = false
}) => {
  const finalWidth = width || screenWidth;
  
  // Format labels for charts
  const chartData = {
    labels: data.labels,
    datasets: data.datasets.map((dataset, index) => ({
      data: dataset.data,
      color: (opacity = 1): string => {
        // If dataset specifies colors for each point
        if (dataset.colors && dataset.colors.length === dataset.data.length) {
          return dataset.colors[index % dataset.colors.length];
        }

        // If dataset specifies a single color
        if (dataset.colors && dataset.colors.length === 1) {
          return dataset.colors[0];
        }

        // Default color based on dataset index
        return CASINO_COLORS.chartColors[index % CASINO_COLORS.chartColors.length];
      },
      strokeWidth: dataset.strokeWidth || 2
    }))
  };
  
  // Common chart config
  const chartConfig = {
    backgroundColor: CASINO_COLORS.background,
    backgroundGradientFrom: CASINO_COLORS.background,
    backgroundGradientTo: CASINO_COLORS.background,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 215, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: CASINO_COLORS.gold
    },
    propsForLabels: {
      fontSize: 12,
    },
    formatYLabel: formatYLabel || ((label) => `${label}${yAxisSuffix}`),
    formatXLabel: formatXLabel || ((label) => label),
  };
  
  // Convert for pie chart format, which is different
  const pieChartData = data.labels.map((label, index) => {
    // Get the value from the first dataset
    const value = data.datasets[0]?.data[index] || 0;
    
    // Get color for this segment
    let color = CASINO_COLORS.chartColors[index % CASINO_COLORS.chartColors.length];
    if (data.datasets[0]?.colors && data.datasets[0].colors[index]) {
      color = data.datasets[0].colors[index];
    }
    
    return {
      name: label,
      value: isNaN(value) ? 0 : value,
      color,
      legendFontColor: CASINO_COLORS.text,
      legendFontSize: 12
    };
  });
  
  // Custom chart value display for bar chart
  const renderBarValues = () => {
    if (!showValues || type !== 'bar') return null;
    
    const dataset = data.datasets[0];
    if (!dataset) return null;
    
    const barWidth = finalWidth / dataset.data.length;
    
    return (
      <View style={[styles.valueOverlay, { width: finalWidth, height }]}>
        {dataset.data.map((value, index) => (
          <View 
            key={index} 
            style={[
              styles.valueContainer, 
              { 
                left: (index * barWidth) + (barWidth / 2) - 15,
                top: height - (value / Math.max(...dataset.data) * height * 0.7) - 20
              }
            ]}
          >
            <Text style={styles.valueText}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Text>
          </View>
        ))}
      </View>
    );
  };
  
  // Render legends for custom charts
  const renderLegend = () => {
    if (!legend || hideLegend) return null;
    
    return (
      <View style={styles.legendContainer}>
        {data.datasets.map((dataset, datasetIndex) => (
          <View key={datasetIndex} style={styles.legendItem}>
            <View 
              style={[
                styles.legendColor, 
                { 
                  backgroundColor: dataset.colors?.[0] || 
                    CASINO_COLORS.chartColors[datasetIndex % CASINO_COLORS.chartColors.length]
                }
              ]} 
            />
            <Text style={styles.legendText}>
              {`Dataset ${datasetIndex + 1}`}
            </Text>
          </View>
        ))}
      </View>
    );
  };
  
  // Helper function to render error message
  const renderError = (message: string) => (
    <View style={[styles.container, { height, width: finalWidth }]}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
  
  // Validate data
  if (!data || !data.labels || !data.datasets || data.datasets.length === 0) {
    return renderError('אין נתונים זמינים');
  }
  
  if (data.datasets.some(ds => !ds.data || ds.data.length === 0)) {
    return renderError('נתונים לא תקינים');
  }
  
  try {
    // Render appropriate chart type
    switch (type) {
      case 'line':
        return (
          <View style={[styles.container, style]}>
            <LineChart
              data={chartData}
              width={finalWidth}
              height={height}
              chartConfig={{
                ...chartConfig,
                strokeWidth: 2,
                propsForBackgroundLines: {
                  strokeWidth: showGrid ? 1 : 0,
                  stroke: showGrid ? 'rgba(255,215,0,0.1)' : 'transparent',
                },
              }}
              bezier
              fromZero
              yAxisSuffix={yAxisSuffix}
                            style={styles.chart}
              withInnerLines={showGrid}
              withOuterLines={showGrid}
              withDots={true}
              withShadow={false}
              withVerticalLines={showGrid}
              withHorizontalLines={showGrid}
              horizontalLabelRotation={horizontalLabels ? 0 : -45}
            />
            {renderLegend()}
          </View>
        );
        
      case 'bar':
        return (
          <View style={[styles.container, style]}>
            <BarChart
              data={chartData}
              width={finalWidth}
              height={height}
              chartConfig={{
                ...chartConfig,
                barPercentage: 0.7,
                propsForBackgroundLines: {
                  strokeWidth: showGrid ? 1 : 0,
                  stroke: showGrid ? 'rgba(255,215,0,0.1)' : 'transparent',
                },
              }}
              style={styles.chart}
              fromZero
              yAxisSuffix={yAxisSuffix}
              yAxisLabel=""
              withInnerLines={showGrid}
              showBarTops={true}
              showValuesOnTopOfBars={showValues}
              withHorizontalLabels={true}
              horizontalLabelRotation={horizontalLabels ? 0 : -45}
            />
            {showValues && renderBarValues()}
            {renderLegend()}
          </View>
        );
        
      case 'pie':
      case 'doughnut':
        return (
          <View style={[styles.container, style]}>
            <PieChart
              data={pieChartData}
              width={finalWidth}
              height={height}
              chartConfig={chartConfig}
              accessor="value"
              backgroundColor="transparent"
              paddingLeft="0"
              absolute
              hasLegend={!hideLegend}
            />
            {renderLegend()}
          </View>
        );
        
      case 'stacked':
        return (
          <View style={[styles.container, style]}>
            <BarChart
              data={chartData}
              width={finalWidth}
              height={height}
              chartConfig={{
                ...chartConfig,
                barPercentage: 0.8,
                propsForBackgroundLines: {
                  strokeWidth: showGrid ? 1 : 0,
                  stroke: showGrid ? 'rgba(255,215,0,0.1)' : 'transparent',
                },
              }}
              style={styles.chart}
              fromZero
              yAxisSuffix={yAxisSuffix}
              yAxisLabel=""
              withInnerLines={showGrid}
              segments={4}
              showValuesOnTopOfBars={false}
              horizontalLabelRotation={horizontalLabels ? 0 : -45}
              withHorizontalLabels={true}
            />
            {renderLegend()}
          </View>
        );
        
      default:
        return renderError('סוג תרשים לא נתמך');
    }
  } catch (error) {
    console.error('Error rendering chart:', error);
    return renderError('שגיאה ביצירת התרשים');
  }
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CASINO_COLORS.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  chart: {
    borderRadius: 8,
    paddingRight: 0,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 8,
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },
  legendText: {
    color: CASINO_COLORS.text,
    fontSize: 12,
  },
  errorText: {
    color: CASINO_COLORS.error,
    fontSize: 14,
    textAlign: 'center',
  },
  valueOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  valueContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
  },
  valueText: {
    color: CASINO_COLORS.gold,
    fontSize: 10,
    fontWeight: 'bold',
  }
});

export default StatisticsChart;