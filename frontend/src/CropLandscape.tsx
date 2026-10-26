import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface CropLandscapeProps {
  data: Array<{ crop: string; count: number }>;
}

const chartColors = ['#174C3C', '#618673', '#A1B9A6', '#C1D68D', '#D6FF62'];

function CropLandscape({ data }: CropLandscapeProps) {
  return (
    <div className="crop-chart" style={{ height: Math.max(220, data.length * 38) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, left: 4, bottom: 4 }} barCategoryGap={12}>
          <CartesianGrid horizontal={false} stroke="#E8EEE8" />
          <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#8CA795', fontSize: 11 }} />
          <YAxis type="category" dataKey="crop" width={88} axisLine={false} tickLine={false} tick={{ fill: '#53685B', fontSize: 12 }} />
          <Tooltip cursor={{ fill: '#F2F6F1' }} contentStyle={{ border: '1px solid #DDE7DE', borderRadius: 10, boxShadow: '0 8px 24px rgba(16,42,34,.08)' }} formatter={(value) => [value, 'Predictions']} />
          <Bar dataKey="count" name="Predictions" radius={[0, 5, 5, 0]} animationDuration={850}>
            {data.map((entry, index) => <Cell key={entry.crop} fill={chartColors[index % chartColors.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default CropLandscape;
