// src/components/DistrictBarChart.js
import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Box, Text, useColorModeValue } from '@chakra-ui/react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const DistrictBarChart = ({ chartData }) => {
  const gridColor = useColorModeValue('rgba(200, 200, 200, 0.4)', 'rgba(255, 255, 255, 0.1)');
  const textColor = useColorModeValue('gray.800', 'white');
  const chartBg = useColorModeValue(
    "linear-gradient(180deg, #E8F1F9 0%, #F4F8FB 100%)", 
    "gray.800"
  );

  if (!chartData || chartData.length === 0) {
    return (
      <Box p={5} borderRadius="lg" textAlign="center" height="100%" minH="200px" display="flex" alignItems="center" justifyContent="center">
        <Text>Select "All Districts" to view the comparison chart or data is loading...</Text>
      </Box>
    );
  }

  // Transform the incoming data
  const labels = chartData.map((d) => d.districtName);
  const onlineData = chartData.map((d) => d.onlineCamera);
  const connectedData = chartData.map((d) => d.isLiveCount || 0); 
  
  // Logic: Inactive = (Online + Offline) - Connected
  const inactiveData = chartData.map((d) => {
    const total = (d.onlineCamera || 0) + (d.offlineCamera || 0);
    const connected = d.isLiveCount || 0;
    const inactive = total - connected;
    return inactive > 0 ? inactive : 0; // Ensure no negative values
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'Online',
        data: onlineData,
        backgroundColor: '#7BC111', // Original Green
      },
      {
        label: 'Inactive', // Changed from Offline
        data: inactiveData,
        backgroundColor: '#ff0800ff', // Original Red
      },
      {
        label: 'Installed', // Matches Dashboard naming
        data: connectedData,
        backgroundColor: '#8760e3ff', // Original Purple
      },
    ],
  };

  const options = {
    indexAxis: 'y', // Horizontal bars (districts on Y, camera counts on X)
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: textColor,
          boxWidth: 20,
          padding: 20,
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      // Value axis (now horizontal) — show vertical gridlines
      x: {
        beginAtZero: true,
        ticks: {
          color: textColor,
          stepSize: 1,
        },
        grid: {
          display: true,
          color: gridColor,
          lineWidth: 1,
        },
        border: {
          display: false,
        },
        title: {
          display: true,
          text: 'Number of Cameras',
          color: textColor,
          font: {
            size: 14,
          },
        },
      },
      // Category axis (district names) — no gridlines
      y: {
        ticks: {
          color: textColor,
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
      },
    },
    barPercentage: 0.6,
    categoryPercentage: 0.7,
  };

  return (
    <Box height="100%" width="100%">
      <Bar options={options} data={data} />
    </Box>
  );
};

export default DistrictBarChart;
