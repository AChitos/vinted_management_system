import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Typography, Box, Paper, List, ListItem,
  Button, Chip, ListItemText, Dialog,
  DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { RestoreFromTrash, DeleteForever, DeleteSweep } from '@mui/icons-material';

function DeletedOrders() {
  const [deletedOrders, setDeletedOrders] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, orderId: null, isDeleteAll: false });

  useEffect(() => {
    fetchDeletedOrders();
  }, []);

  const fetchDeletedOrders = () => {
    axios.get('http://127.0.0.1:5000/deleted-orders')
      .then(response => setDeletedOrders(response.data))
      .catch(error => console.error('Error fetching deleted orders:', error));
  };

  const handleRecover = async (order_id) => {
    try {
      await axios.post(`http://127.0.0.1:5000/deleted-orders/${order_id}`);
      setDeletedOrders(deletedOrders.filter(order => order.order_id !== order_id));
    } catch (error) {
      console.error('Error recovering order:', error);
    }
  };

  const handlePermanentDelete = async (order_id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/deleted-orders/${order_id}`);
      setDeletedOrders(deletedOrders.filter(order => order.order_id !== order_id));
      setConfirmDialog({ open: false, orderId: null, isDeleteAll: false });
    } catch (error) {
      console.error('Error permanently deleting order:', error);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await axios.delete('http://127.0.0.1:5000/deleted-orders');
      setDeletedOrders([]);
      setConfirmDialog({ open: false, orderId: null, isDeleteAll: false });
    } catch (error) {
      console.error('Error deleting all orders:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Deleted Orders
        </Typography>
        {deletedOrders.length > 0 && (
          <Button
            startIcon={<DeleteSweep />}
            variant="contained"
            color="error"
            onClick={() => setConfirmDialog({ open: true, orderId: null, isDeleteAll: true })}
          >
            Delete All
          </Button>
        )}
      </Box>

      <List>
        {deletedOrders.map(order => (
          <Paper key={order.order_id} sx={{ mb: 2, p: 2 }}>
            <ListItem>
              <ListItemText
                primary={
                  <Typography variant="h6">
                    Order #{order.order_id}
                    <Chip 
                      label={`Deleted on: ${order.deletion_date}`}
                      color="error"
                      size="small"
                      sx={{ ml: 2 }}
                    />
                  </Typography>
                }
                secondary={
                  <>
                    <Typography component="span" variant="body2">
                      Customer: {order.buyer_name}<br/>
                      Items: {order.items_purchased}<br/>
                      Total: ${order.total_cost}
                    </Typography>
                  </>
                }
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  startIcon={<RestoreFromTrash />}
                  variant="contained"
                  color="primary"
                  onClick={() => handleRecover(order.order_id)}
                >
                  Recover
                </Button>
                <Button
                  startIcon={<DeleteForever />}
                  variant="contained"
                  color="error"
                  onClick={() => setConfirmDialog({ open: true, orderId: order.order_id })}
                >
                  Delete
                </Button>
              </Box>
            </ListItem>
          </Paper>
        ))}
      </List>

      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, orderId: null, isDeleteAll: false })}
      >
        <DialogTitle>
          {confirmDialog.isDeleteAll ? 'Confirm Delete All' : 'Confirm Permanent Deletion'}
        </DialogTitle>
        <DialogContent>
          {confirmDialog.isDeleteAll 
            ? 'Are you sure you want to permanently delete ALL deleted orders? This action cannot be undone.'
            : 'Are you sure you want to permanently delete this order? This action cannot be undone.'}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, orderId: null, isDeleteAll: false })}>
            Cancel
          </Button>
          <Button 
            onClick={() => confirmDialog.isDeleteAll 
              ? handleDeleteAll() 
              : handlePermanentDelete(confirmDialog.orderId)}
            color="error"
            variant="contained"
          >
            {confirmDialog.isDeleteAll ? 'Delete All Permanently' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DeletedOrders;
