import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { buildChartData } from '@/utils/scoreUtils';
import type { ScoreEventDto } from '@/types/user.types';

export interface ScoreLineChartProps {
  history: ScoreEventDto[];
  currentScore: number;
}

const chartConfig = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(26, 107, 60, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  style: {
    borderRadius: 16,
    paddingRight: 16,
  },
};

export const ScoreLineChart: React.FC<ScoreLineChartProps> = ({
  history,
  currentScore,
}) => {
  const { labels, data } = buildChartData(history, currentScore);
  const width = Dimensions.get('window').width - 32;

  return (
    <View style={styles.container}>
      <LineChart
        data={{
          labels,
          datasets: [{ data }],
        }}
        width={width}
        height={200}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
        withDots
        withInnerLines
        fromZero={false}
        yAxisSuffix=""
        yAxisInterval={1}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    alignItems: 'center',
  },
  chart: {
    borderRadius: 16,
  },
});
