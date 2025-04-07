from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
import numpy as np
import logging

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
CORS(app)

# Load product data from CSV
products_df = pd.read_csv('products.csv')
products = products_df.to_dict(orient='records')

# Load transactions data from CSV
transactions_df = pd.read_csv('transactions.csv')
transactions = transactions_df.groupby('transaction_id')['item'].apply(list).tolist()

# Multiply transactions for better analysis
all_transactions = []
transaction_id = 1

for _ in range(20):  # Multiply each transaction 20 times with some variations
    for base_transaction in transactions:
        # Add some randomness to transactions
        if np.random.random() > 0.7:  # 30% chance to modify transaction
            if len(base_transaction) > 3:
                # Randomly remove one item
                transaction = base_transaction[:-1]
            else:
                # Randomly add one item
                additional_item = np.random.choice([p["name"] for p in products])
                transaction = base_transaction + [additional_item]
        else:
            transaction = base_transaction
        
        # Add transaction ID and items
        all_transactions.extend([(transaction_id, item) for item in transaction])
        transaction_id += 1

# Create DataFrame for analysis
df = pd.DataFrame(all_transactions, columns=['Transaction', 'Item'])

def generate_recommendations(cart_items=[]):
    """
    Generate product recommendations based on market basket analysis
    Returns at least 6 recommended items
    """
    # Create one-hot encoded DataFrame
    one_hot = pd.get_dummies(df.set_index('Transaction')['Item']).groupby(level=0).max()
    
    # Generate frequent itemsets with lower support for more recommendations
    frequent_itemsets = apriori(one_hot, min_support=0.005, use_colnames=True)
    
    if frequent_itemsets.empty:
        return get_popular_items(6)
    
    # Generate association rules with lower threshold
    rules = association_rules(frequent_itemsets, metric="lift", min_threshold=0.5)
    
    if not cart_items:
        # Return most frequent items if cart is empty
        return get_popular_items(6)
    
    # Filter rules based on cart items
    relevant_rules = rules[rules['antecedents'].apply(lambda x: any(item in x for item in cart_items))]
    
    if relevant_rules.empty:
        return get_popular_items(6)
    
    # Sort rules by confidence and lift
    relevant_rules = relevant_rules.sort_values(['confidence', 'lift'], ascending=[False, False])
    
    # Get recommended items
    recommendations = set()
    for _, row in relevant_rules.iterrows():
        recommendations.update(row['consequents'])
        if len(recommendations) >= 8:  # Get extra items to ensure we have enough after filtering
            break
    
    # Remove items already in cart
    recommendations = recommendations - set(cart_items)
    
    # Convert frozen sets to list of product objects
    recommended_products = []
    for item_name in list(recommendations):
        product = next((p for p in products if p['name'] == item_name), None)
        if product:
            recommended_products.append(product)
    
    # Fill remaining slots with popular items if needed
    if len(recommended_products) < 6:
        popular_items = get_popular_items(6 - len(recommended_products), 
                                        exclude=cart_items + [p['name'] for p in recommended_products])
        recommended_products.extend(popular_items)
    
    return recommended_products[:8]  # Return up to 8 recommendations

def get_popular_items(count, exclude=[]):
    """
    Get most frequently purchased items
    """
    popular_items = df['Item'].value_counts().index.tolist()
    recommended_products = []
    
    for item_name in popular_items:
        if item_name not in exclude:
            product = next((p for p in products if p['name'] == item_name), None)
            if product:
                recommended_products.append(product)
                if len(recommended_products) >= count:
                    break
    
    return recommended_products

def get_frequently_bought_together(cart_items=[]):
    """
    Get items frequently bought together based on current cart,
    returning exactly 4 items including one from the cart when possible
    """
    if not cart_items:
        return get_popular_items(4)
        
    one_hot = pd.get_dummies(df.set_index('Transaction')['Item']).groupby(level=0).max()
    frequent_itemsets = apriori(one_hot, min_support=0.01, use_colnames=True)
    
    if frequent_itemsets.empty:
        return get_popular_items(4)
    
    # Find itemsets containing cart items
    relevant_itemsets = frequent_itemsets[
        frequent_itemsets['itemsets'].apply(lambda x: any(item in x for item in cart_items))
    ]
    
    if relevant_itemsets.empty:
        # Include one cart item in recommendations
        recommendations = []
        if cart_items:
            product = next((p for p in products if p['name'] == cart_items[0]), None)
            if product:
                recommendations.append(product)
        popular_items = get_popular_items(4 - len(recommendations), exclude=cart_items)
        recommendations.extend(popular_items)
        return recommendations[:4]  # Ensure exactly 4 items
    
    # Include one cart item in recommendations
    recommendations = []
    if cart_items:
        product = next((p for p in products if p['name'] == cart_items[0]), None)
        if product:
            recommendations.append(product)
    
    # Get items frequently bought together
    recommendation_set = set()
    for _, row in relevant_itemsets.iterrows():
        recommendation_set.update(row['itemsets'])
        if len(recommendation_set) >= 6:  # Get extra items to account for filtering
            break
    
    # Remove all cart items from recommendations
    recommendation_set = recommendation_set - set(cart_items)
    
    # Convert to product objects
    for item_name in list(recommendation_set):
        if len(recommendations) >= 4:  # Limit to exactly 4 recommendations
            break
        product = next((p for p in products if p['name'] == item_name), None)
        if product:
            recommendations.append(product)
    
    # Fill remaining slots if needed
    if len(recommendations) < 4:
        popular_items = get_popular_items(4 - len(recommendations), 
                                        exclude=cart_items + [p['name'] for p in recommendations])
        recommendations.extend(popular_items)
    
    return recommendations[:4]  # Return exactly 4 recommendations

@app.route('/products', methods=['GET'])
def get_products():
    return jsonify(products)

@app.route('/recommendations', methods=['POST'])
def get_recommendations():
    cart_items = request.json.get('cart_items', [])
    
    if not isinstance(cart_items, list):
        return jsonify({"error": "cart_items should be a list"}), 400
    
    recommendations = generate_recommendations(cart_items)
    frequently_bought = get_frequently_bought_together(cart_items)
    
    return jsonify({
        "recommendations": recommendations,
        "frequently_bought_together": frequently_bought
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)