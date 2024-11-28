import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Typography, Box, Card, CardContent, Grid,
  TextField, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead,
  TableRow, IconButton, Tooltip,
  TablePagination, Chip
} from '@mui/material';
import { Delete as DeleteIcon, Timeline } from '@mui/icons-material';
import { formatEuros } from '../utils/currency';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

function Financial() {
  const [financialData, setFinancialData] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [summary, setSummary] = useState({
    totalProfit: 0,
    totalSales: 0,
    totalFees: 0,
    totalExpenses: 0
  });
  const [graphData, setGraphData] = useState([]);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/financial');
      const data = response.data;
      setFinancialData(data);
      calculateSummary(data);
      prepareGraphData(data);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    }
  };

  const calculateSummary = (data) => {
    const summary = data.reduce((acc, record) => ({
      totalProfit: acc.totalProfit + parseFloat(record.profit || 0),
      totalSales: acc.totalSales + parseFloat(record.total_sales || 0),
      totalFees: acc.totalFees + parseFloat(record.fees || 0),
      totalExpenses: acc.totalExpenses + parseFloat(record.expenses || 0)
    }), {
      totalProfit: 0,
      totalSales: 0,
      totalFees: 0,
      totalExpenses: 0
    });
    setSummary(summary);
  };

  const prepareGraphData = (data) => {
    // Group data by date and calculate daily totals
    const groupedData = data.reduce((acc, record) => {
      const date = record.transaction_date;
      if (!acc[date]) {
        acc[date] = {
          date,
          sales: 0,
          profit: 0
        };
      }
      acc[date].sales += parseFloat(record.total_sales || 0);
      acc[date].profit += parseFloat(record.profit || 0);
      return acc;
    }, {});

    // Convert to array and sort by date
    const graphData = Object.values(groupedData).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    setGraphData(graphData);
  };

  const handleDeleteRecord = async (transactionId) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await axios.delete(`http://127.0.0.1:5000/financial/${transactionId}`);
        fetchFinancialData();
      } catch (error) {
        console.error('Error deleting record:', error);
      }
    }
  };

  const filteredData = financialData.filter(record => {
    const recordDate = new Date(record.transaction_date);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return (!start || recordDate >= start) && (!end || recordDate <= end);
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Financial Summary
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { title: 'Total Sales', value: summary.totalSales, color: 'primary' },
          { title: 'Total Profit', value: summary.totalProfit, color: 'success' },
          { title: 'Total Fees', value: summary.totalFees, color: 'warning' },
          { title: 'Total Expenses', value: summary.totalExpenses, color: 'error' }
        ].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.title}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  {item.title}
                </Typography>
                <Typography variant="h5" component="div" color={`${item.color}.main`}>
                  {formatEuros(item.value)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Sales and Profit Over Time
        </Typography>
        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={graphData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `€${value}`}
              />
              <RechartsTooltip 
                formatter={(value) => `€${value.toFixed(2)}`}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#2196f3" 
                name="Sales"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="#4caf50" 
                name="Profit"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Transaction ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Order ID</TableCell>
              <TableCell align="right">Sales</TableCell>
              <TableCell align="right">Profit</TableCell>
              <TableCell align="right">Fees</TableCell>
              <TableCell align="right">Expenses</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((record) => (
                <TableRow key={record.transaction_id}>
                  <TableCell>{record.transaction_id}</TableCell>
                  <TableCell>{record.transaction_date}</TableCell>
                  <TableCell>
                    <Chip label={`Order #${record.order_id}`} size="small" />
                  </TableCell>
                  <TableCell align="right">{formatEuros(record.total_sales)}</TableCell>
                  <TableCell align="right">{formatEuros(record.profit)}</TableCell>
                  <TableCell align="right">{formatEuros(record.fees)}</TableCell>
                  <TableCell align="right">{formatEuros(record.expenses)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete Record">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteRecord(record.transaction_id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>
    </Box>
  );
}

export default Financial;