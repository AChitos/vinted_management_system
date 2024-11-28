from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import csv
import os
from rembg import remove
from PIL import Image, ImageOps
import uuid
from werkzeug.utils import secure_filename
import io
import zipfile
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import hashlib
from functools import lru_cache
import numpy as np
from rembg.session_factory import new_session

app = Flask(__name__)

# Single CORS configuration
CORS(app, resources={
    r"/*": {
        "origins": "http://localhost:3000",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

# File paths
INVENTORY_FILE = 'inventory.csv'
ORDERS_FILE = 'orders.csv'
FINANCIAL_FILE = 'financial.csv'

# Add this constant at the top with other constants
ORDER_FIELDS = ['order_id', 'buyer_name', 'order_date', 'items_purchased', 
                'total_cost', 'shipping_status', 'sales_price']

# Add new constant for deleted orders file
DELETED_ORDERS_FILE = 'deleted_orders.csv'

# Add new constant for financial fields
FINANCIAL_FIELDS = ['transaction_id', 'order_id', 'transaction_date', 'profit', 'fees', 'expenses', 'total_sales']

# Add these constants after other constants
UPLOAD_FOLDER = 'static/images/uploads'
PROCESSED_FOLDER = 'static/images/processed'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROCESSED_FOLDER'] = PROCESSED_FOLDER

# Add these constants after other constants
MAX_WORKERS = 4  # Adjust based on your CPU cores
CACHE_SIZE = 100  # Number of images to cache

# Add request timeout and max content length
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROCESSED_FOLDER'] = PROCESSED_FOLDER

@lru_cache(maxsize=CACHE_SIZE)
def process_image_cached(image_hash):
    # This function will cache results based on image content
    return True

def get_image_hash(image):
    # Create a hash of the image content for caching
    return hashlib.md5(np.array(image).tobytes()).hexdigest()

def process_single_image(file):
    try:
        filename = str(uuid.uuid4()) + '.jpg'
        output_path = os.path.join(app.config['PROCESSED_FOLDER'], filename)
        
        # Open and process image with error handling
        try:
            input_image = Image.open(file)
        except Exception as e:
            print(f"Error opening image: {str(e)}")
            return None
            
        # Ensure image is in correct mode and orientation
        try:
            input_image = ImageOps.exif_transpose(input_image)
        except Exception as e:
            print(f"Error in exif transpose: {str(e)}")
            
        # Process image
        try:
            # Create a new session with CPU provider
            session = new_session("u2net", providers=['CPUExecutionProvider'])
            
            # Process image with optimization flags
            output_image = remove(
                input_image,
                session=session,
                alpha_matting=True,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10,
                post_process_mask=True
            )
            
            # Create white background
            white_bg = Image.new('RGBA', output_image.size, (255, 255, 255, 255))
            white_bg.paste(output_image, (0, 0), output_image)
            
            # Optimize final image
            white_bg = white_bg.convert('RGB')
            white_bg.save(output_path, 'JPEG', quality=95, optimize=True)
            
            return {
                'filename': filename,
                'processed_url': f'/static/images/processed/{filename}'
            }
            
        except Exception as e:
            print(f"Error in image processing: {str(e)}")
            return None
                
    except Exception as e:
        print(f"Error in process_single_image: {str(e)}")
        return None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Helper functions to read/write CSV files
def read_csv(file_path):
    if not os.path.exists(file_path):
        return []
    with open(file_path, mode='r') as file:
        reader = csv.DictReader(file)
        return list(reader)

def write_csv(file_path, data, fieldnames):
    with open(file_path, mode='w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)
    return True

# CRUD Operations for Inventory Management
@app.route('/inventory', methods=['GET', 'POST'])
def manage_inventory():
    if request.method == 'GET':
        inventory = read_csv(INVENTORY_FILE)
        return jsonify(inventory)
    elif request.method == 'POST':
        new_item = request.json
        inventory = read_csv(INVENTORY_FILE)
        inventory.append(new_item)
        write_csv(INVENTORY_FILE, inventory, new_item.keys())
        return jsonify(new_item), 201

@app.route('/inventory/<item_name>', methods=['PUT', 'DELETE'])
def update_delete_inventory(item_name):
    inventory = read_csv(INVENTORY_FILE)
    item = next((item for item in inventory if item['item_name'] == item_name), None)
    if not item:
        return jsonify({'error': 'Item not found'}), 404

    if request.method == 'PUT':
        updated_item = request.json
        inventory = [updated_item if item['item_name'] == item_name else item for item in inventory]
        write_csv(INVENTORY_FILE, inventory, updated_item.keys())
        return jsonify(updated_item)
    elif request.method == 'DELETE':
        inventory = [item for item in inventory if item['item_name'] != item_name]
        write_csv(INVENTORY_FILE, inventory, item.keys())
        return jsonify({'message': 'Item deleted'})

# Order Management
@app.route('/orders', methods=['GET', 'POST'])
def manage_orders():
    if request.method == 'GET':
        return jsonify(read_csv(ORDERS_FILE))
    
    elif request.method == 'POST':
        new_order = request.json
        
        # Check inventory
        inventory = read_csv(INVENTORY_FILE)
        item = next((item for item in inventory if item['item_name'] == new_order['items_purchased']), None)
        
        if not item or int(item['quantity']) <= 0:
            return jsonify({'error': 'Item out of stock'}), 400
            
        orders = read_csv(ORDERS_FILE)
        
        # Generate order_id and add date
        if not new_order.get('order_id'):
            max_id = max([int(o['order_id']) for o in orders]) if orders else 0
            new_order['order_id'] = str(max_id + 1)
        if not new_order.get('order_date'):
            from datetime import date
            new_order['order_date'] = date.today().isoformat()
        
        # Create financial record
        financial_data = read_csv(FINANCIAL_FILE)
        profit = float(new_order['sales_price']) - float(new_order['total_cost'])
        fees = float(new_order['total_cost']) * 0.1  # Example: 10% fees
        
        financial_record = {
            'transaction_id': str(len(financial_data) + 1),
            'order_id': new_order['order_id'],
            'transaction_date': new_order['order_date'],
            'profit': str(profit),
            'fees': str(fees),
            'expenses': '0',  # Default expenses
            'total_sales': new_order['sales_price']
        }
        
        # Save both order and financial record
        orders.append(new_order)
        financial_data.append(financial_record)
        
        write_csv(ORDERS_FILE, orders, ORDER_FIELDS)
        write_csv(FINANCIAL_FILE, financial_data, FINANCIAL_FIELDS)
        
        return jsonify(new_order), 201

@app.route('/orders/<order_id>', methods=['PUT', 'DELETE'])
def manage_single_order(order_id):
    orders = read_csv(ORDERS_FILE)
    order = next((order for order in orders if order['order_id'] == order_id), None)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    if request.method == 'PUT':
        updated_order = request.json
        # Preserve order_id
        updated_order['order_id'] = order_id
        # If order_date is not provided, keep the original
        if 'order_date' not in updated_order:
            updated_order['order_date'] = order['order_date']
            
        # Update financial records if cost or sales price changed
        if (float(updated_order['total_cost']) != float(order['total_cost']) or 
            float(updated_order['sales_price']) != float(order['sales_price'])):
            financial_data = read_csv(FINANCIAL_FILE)
            # Find and update corresponding financial record
            for record in financial_data:
                if record['order_id'] == order_id:
                    profit = float(updated_order['sales_price']) - float(updated_order['total_cost'])
                    fees = float(updated_order['total_cost']) * 0.1  # 10% fees
                    record['profit'] = str(profit)
                    record['fees'] = str(fees)
                    record['total_sales'] = updated_order['sales_price']
                    break
            write_csv(FINANCIAL_FILE, financial_data, FINANCIAL_FIELDS)
        
        # Update orders list
        orders = [updated_order if o['order_id'] == order_id else o for o in orders]
        write_csv(ORDERS_FILE, orders, ORDER_FIELDS)
        return jsonify(updated_order)
        
    elif request.method == 'DELETE':
        # Save the order to deleted_orders before removing it
        deleted_orders = read_csv(DELETED_ORDERS_FILE)
        from datetime import date
        order['deletion_date'] = date.today().isoformat()
        deleted_orders.append(order)
        write_csv(DELETED_ORDERS_FILE, deleted_orders, ORDER_FIELDS + ['deletion_date'])

        # Remove from active orders
        orders = [o for o in orders if o['order_id'] != order_id]
        write_csv(ORDERS_FILE, orders, ORDER_FIELDS)
        return jsonify({'message': 'Order deleted and archived successfully'})

# Add new endpoints for deleted orders
@app.route('/deleted-orders', methods=['GET', 'DELETE'])  # Add DELETE method
def get_deleted_orders():
    if request.method == 'GET':
        deleted_orders = read_csv(DELETED_ORDERS_FILE)
        return jsonify(deleted_orders)
    elif request.method == 'DELETE':
        # Clear all deleted orders
        write_csv(DELETED_ORDERS_FILE, [], ORDER_FIELDS + ['deletion_date'])
        return jsonify({'message': 'All deleted orders permanently removed'})

@app.route('/deleted-orders/<order_id>', methods=['DELETE', 'POST'])
def manage_deleted_order(order_id):
    deleted_orders = read_csv(DELETED_ORDERS_FILE)
    order = next((order for order in deleted_orders if order['order_id'] == order_id), None)
    
    if not order:
        return jsonify({'error': 'Deleted order not found'}), 404

    if request.method == 'DELETE':
        # Permanently delete
        deleted_orders = [o for o in deleted_orders if o['order_id'] != order_id]
        write_csv(DELETED_ORDERS_FILE, deleted_orders, ORDER_FIELDS + ['deletion_date'])
        return jsonify({'message': 'Order permanently deleted'})
    
    elif request.method == 'POST':
        # Create a copy of the order to avoid modifying the original
        recovered_order = order.copy()
        # Remove only the deletion_date field
        recovered_order.pop('deletion_date', None)
        
        # Get current orders and append the recovered order
        orders = read_csv(ORDERS_FILE)
        orders.append(recovered_order)
        write_csv(ORDERS_FILE, orders, ORDER_FIELDS)
        
        # Remove from deleted orders
        deleted_orders = [o for o in deleted_orders if o['order_id'] != order_id]
        write_csv(DELETED_ORDERS_FILE, deleted_orders, ORDER_FIELDS + ['deletion_date'])
        
        return jsonify({
            'message': 'Order recovered successfully',
            'recovered_order': recovered_order
        })

# Profit and Expense Tracking
@app.route('/financial', methods=['GET', 'POST'])
def manage_financial():
    if request.method == 'GET':
        financial_data = read_csv(FINANCIAL_FILE)
        return jsonify(financial_data)
    elif request.method == 'POST':
        new_record = request.json
        financial_data = read_csv(FINANCIAL_FILE)
        financial_data.append(new_record)
        write_csv(FINANCIAL_FILE, financial_data, new_record.keys())
        return jsonify(new_record), 201

@app.route('/financial/<transaction_id>', methods=['DELETE'])
def delete_financial_record(transaction_id):
    financial_data = read_csv(FINANCIAL_FILE)
    filtered_data = [r for r in financial_data if r['transaction_id'] != transaction_id]
    
    if len(filtered_data) < len(financial_data):
        write_csv(FINANCIAL_FILE, filtered_data, 
                 ['transaction_id', 'profit', 'fees', 'expenses'])
        return jsonify({'message': 'Financial record deleted successfully'})
    
    return jsonify({'error': 'Record not found'}), 404

@app.route('/remove-background', methods=['POST', 'OPTIONS'])
def remove_background():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        if 'images[]' not in request.files:
            return jsonify({'error': 'No images provided'}), 400
        
        files = request.files.getlist('images[]')
        if not files:
            return jsonify({'error': 'No files selected'}), 400
        
        # Create directories if they don't exist
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)
        
        # Process images one at a time instead of parallel for stability
        processed_images = []
        for file in files:
            if file and allowed_file(file.filename):
                result = process_single_image(file)
                if result:
                    processed_images.append(result)
        
        if not processed_images:
            return jsonify({'error': 'No images were successfully processed'}), 400
        
        # Create ZIP file
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        zip_filename = f'processed_images_{timestamp}.zip'
        zip_path = os.path.join(app.config['PROCESSED_FOLDER'], zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zipf:
            for img in processed_images:
                img_path = os.path.join(app.config['PROCESSED_FOLDER'], img['filename'])
                zipf.write(img_path, os.path.basename(img_path))
        
        return jsonify({
            'message': f'Successfully processed {len(processed_images)} images',
            'processed_images': processed_images,
            'zip_url': f'/static/images/processed/{zip_filename}'
        }), 200
            
    except Exception as e:
        print(f"Error in remove-background endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/static/images/<folder>/<filename>')
def serve_image(folder, filename):
    return send_from_directory(f'static/images/{folder}', filename)

if __name__ == '__main__':
    app.run(debug=True)