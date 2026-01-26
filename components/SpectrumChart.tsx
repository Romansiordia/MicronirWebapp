
import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { SpectrumPoint } from '../types';

interface SpectrumChartProps {
  data: SpectrumPoint[];
}

const SpectrumChart: React.FC<SpectrumChartProps> = ({ data }) => {
  return (
    <div className="w-full h-full min-h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
        >
          <defs>
            <linearGradient id="colorIntensity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="wavelength" 
            label={{ value: 'Wavelength (nm)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis 
            label={{ value: 'Absorbance', angle: -90, position: 'insideLeft', offset: 15, fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={{ stroke: '#cbd5e1' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
            itemStyle={{ color: '#22d3ee' }}
            cursor={{ stroke: '#22d3ee', strokeWidth: 1 }}
            labelFormatter={(label) => `${label} nm`}
          />
          <Area 
            type="monotone" 
            dataKey="intensity" 
            stroke="#0891b2" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorIntensity)" 
            animationDuration={1500}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SpectrumChart;
