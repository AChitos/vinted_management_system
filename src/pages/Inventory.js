import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Typography, Box, TextField,
  Card, CardContent, Grid, Chip,
  IconButton, Tooltip, InputAdornment, MenuItem,
  FormControl, Select, InputLabel, Button,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { Search, Edit, Delete, Add as AddIcon, ShoppingCart as SoldIcon } from '@mui/icons-material';
import { formatEuros } from '../utils/currency';

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [openDialog, setOpenDialog] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [newItem, setNewItem] = useState({
    item_name: '',
    category: '',
    size: '',
    condition: '',
    cost: '',
    quantity: '',
    description: ''
  });
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [sellDialog, setSellDialog] = useState(false);
  const [sellingItem, setSellingItem] = useState(null);
  const [salePrice, setSalePrice] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/inventory');
      console.log('Raw inventory response:', response);
      setInventory(response.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const handleSort = (field) => {
    const sorted = [...inventory].sort((a, b) => {
      if (field === 'cost') return a.cost - b.cost;
      return a[field].localeCompare(b[field]);
    });
    setInventory(sorted);
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setNewItem(item);
    setOpenDialog(true);
  };

  const handleDelete = async (item) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await axios.delete(`http://127.0.0.1:5000/inventory/${item.item_name}`);
        fetchInventory();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      if (editItem) {
        await axios.put(`http://127.0.0.1:5000/inventory/${editItem.item_name}`, newItem);
      } else {
        await axios.post('http://127.0.0.1:5000/inventory', newItem);
      }
      setOpenDialog(false);
      setEditItem(null);
      setNewItem({});
      fetchInventory();
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const handleMarkAsSold = (item) => {
    setSellingItem(item);
    setSalePrice(item.cost.toString()); // Set initial sale price to item's cost
    setSellDialog(true);
  };

  const handleConfirmSale = async () => {
    try {
      if (!salePrice || parseFloat(salePrice) <= 0) {
        alert('Please enter a valid sale price');
        return;
      }

      if (!sellingItem) {
        alert('No item selected for sale');
        return;
      }

      if (parseInt(sellingItem.quantity) <= 0) {
        alert('This item is out of stock!');
        setSellDialog(false);
        return;
      }

      const newOrder = {
        buyer_name: 'Pending',
        items_purchased: sellingItem.item_name,
        total_cost: parseFloat(sellingItem.cost),
        shipping_status: 'Pending',
        sales_price: parseFloat(salePrice),
        order_date: new Date().toISOString().split('T')[0]
      };

      console.log('Creating order with data:', newOrder); // Debug log

      const updatedItem = {
        ...sellingItem,
        quantity: (parseInt(sellingItem.quantity) - 1).toString()
      };

      // First update inventory
      const inventoryResponse = await axios.put(`http://127.0.0.1:5000/inventory/${sellingItem.item_name}`, updatedItem);
      console.log('Inventory update response:', inventoryResponse); // Debug log

      // Then create order
      const orderResponse = await axios.post('http://127.0.0.1:5000/orders', newOrder);
      console.log('Order creation response:', orderResponse); // Debug log

      fetchInventory();
      setSellDialog(false);
      setSellingItem(null);
      setSalePrice('');
      
    } catch (error) {
      console.error('Error creating order:', error);
      console.error('Error response:', error.response); // Debug log
      alert('Error creating order: ' + (error.response?.data?.message || error.response?.data || error.message || 'Unknown error'));
    }
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setDetailsDialog(true);
  };

  const filteredInventory = inventory.filter(item =>
    item?.item_name?.toLowerCase().includes(searchTerm?.toLowerCase() || '') &&
    (categoryFilter ? item?.category === categoryFilter : true)
  );


  return (
    <Box sx={{ p: 3 }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Inventory Management</Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search Inventory"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="T-shirts">T-shirts</MenuItem>
                  <MenuItem value="Polo T-shirts">Polo T-shirts</MenuItem>
                  <MenuItem value="Hoodies">Hoodies</MenuItem>
                  <MenuItem value="Sweaters">Sweaters</MenuItem>
                  <MenuItem value="Knitwear">Knitwear</MenuItem>
                  <MenuItem value="Pants">Pants</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={e => {
                    setSortBy(e.target.value);
                    handleSort(e.target.value);
                  }}
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="cost">Cost</MenuItem>
                  <MenuItem value="quantity">Quantity</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setOpenDialog(true)}
        sx={{ mb: 2 }}
      >
        Add New Item
      </Button>

      <Grid container spacing={3}>
        {filteredInventory.map((item, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">{item.item_name}</Typography>
                  <Chip 
                    label={item.condition}
                    color={item.condition === 'New' ? 'success' : 'primary'}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Category: {item.category}<br/>
                  Size: {item.size}<br/>
                  Cost: {formatEuros(item.cost)}<br/>
                  Stock: {item.quantity} units
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Tooltip title="View Details">
                    <IconButton color="primary" onClick={() => handleViewDetails(item)}>
                      <Search />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Mark as Sold">
                    <IconButton 
                      color="success" 
                      onClick={() => handleMarkAsSold(item)}
                      disabled={parseInt(item.quantity) <= 0}
                    >
                      <SoldIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit (Requires Permission)">
                    <span>
                      <IconButton onClick={() => handleEdit(item)}>
                        <Edit />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Delete (Requires Permission)">
                    <span>
                      <IconButton color="error" onClick={() => handleDelete(item)}>
                        <Delete />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={detailsDialog} onClose={() => setDetailsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Product Details</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6">{selectedItem.item_name}</Typography>
                <Chip 
                  label={selectedItem.condition}
                  color={selectedItem.condition === 'New' ? 'success' : 'primary'}
                  sx={{ ml: 1 }}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Category</Typography>
                <Typography>{selectedItem.category}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Size</Typography>
                <Typography>{selectedItem.size}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Cost</Typography>
                <Typography>{formatEuros(selectedItem.cost)}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Stock</Typography>
                <Typography>{selectedItem.quantity} units</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2">Description</Typography>
                <Typography>{selectedItem.description}</Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>{editItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Item Name"
            value={newItem.item_name || ''}
            onChange={e => setNewItem({...newItem, item_name: e.target.value})}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Category"
            value={newItem.category || ''}
            onChange={e => setNewItem({...newItem, category: e.target.value})}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Size"
            value={newItem.size || ''}
            onChange={e => setNewItem({...newItem, size: e.target.value})}
            fullWidth
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Condition</InputLabel>
            <Select
              value={newItem.condition || ''}
              onChange={e => setNewItem({...newItem, condition: e.target.value})}
            >
              <MenuItem value="New">New</MenuItem>
              <MenuItem value="Like New">Like New</MenuItem>
              <MenuItem value="Used">Used</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Cost"
            type="number"
            value={newItem.cost || ''}
            onChange={e => setNewItem({...newItem, cost: e.target.value})}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Quantity"
            type="number"
            value={newItem.quantity || ''}
            onChange={e => setNewItem({...newItem, quantity: e.target.value})}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Description"
            value={newItem.description || ''}
            onChange={e => setNewItem({...newItem, description: e.target.value})}
            fullWidth
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editItem ? 'Save Changes' : 'Add Item'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={sellDialog} onClose={() => setSellDialog(false)}>
        <DialogTitle>Set Sale Price</DialogTitle>
        <DialogContent>
          <TextField
            label="Sale Price"
            type="number"
            value={salePrice}
            onChange={e => setSalePrice(e.target.value)}
            fullWidth
            margin="normal"
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
          />
          <Typography variant="body2" color="text.secondary">
            Original Cost: {formatEuros(sellingItem?.cost)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSellDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmSale} variant="contained" color="success">
            Confirm Sale
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Inventory;