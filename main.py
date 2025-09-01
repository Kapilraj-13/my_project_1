from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt
import io
import base64

app = Flask(__name__)
CORS(app)

# Load and prepare the data globally from the single file
try:
    # Read the combined data file
    df = pd.read_csv('tn_distance.csv')

    # Filter the DataFrame to get graph data (where Source is not NaN)
    graph_df = df.dropna(subset=['Source'])
    
    # Filter the DataFrame to get coordinate data (where District is not NaN)
    coords_df = df.dropna(subset=['District'])
    
    # Create the graph from the filtered relationship data
    G = nx.Graph()
    for _, row in graph_df.iterrows():
        source = row['Source']
        destination = row['Destination']
        distance = row['Distance_km']
        time = row['Time_hr']
        G.add_edge(source, destination, distance=distance, time=time)
    
    # Store positions for plotting from the filtered coordinate data
    pos = {row['District']: (row['Longitude'], row['Latitude']) for _, row in coords_df.iterrows()}
    
    # Get a list of all districts for the dropdown menu
    districts = sorted(list(G.nodes()))

except Exception as e:
    print(f"Error loading data: {e}")
    G = None
    districts = []

@app.route('/')
def index():
    return open('index.html').read()

@app.route('/districts')
def get_districts():
    """API endpoint to get the list of available districts."""
    return jsonify(districts)

@app.route('/shortest-path')
def shortest_path():
    """
    API endpoint to calculate the shortest path and return a JSON object
    with path details and a Base64 encoded image.
    """
    if not G:
        return jsonify({"error": "Graph data not loaded. Check server logs."}), 500
        
    source = request.args.get('source')
    destination = request.args.get('destination')
    
    if not source or not destination:
        return jsonify({"error": "Missing source or destination parameters."}), 400
    
    if source not in G or destination not in G:
        return jsonify({"error": "Source or destination district not found."}), 404

    try:
        # Calculate shortest path by distance
        path = nx.dijkstra_path(G, source=source, target=destination, weight='distance')
        distance = nx.dijkstra_path_length(G, source=source, target=destination, weight='distance')
        
        # Calculate the total time for the path found based on distance
        total_time = sum(G[path[i]][path[i+1]]['time'] for i in range(len(path) - 1))
        
        # Generate the plot
        plt.figure(figsize=(10, 8))
        path_nodes = set(path)
        subgraph = G.subgraph(path_nodes)
        path_pos = {node: pos[node] for node in subgraph.nodes()}
        
        nx.draw_networkx_nodes(G, pos, node_color='lightgray', node_size=150)
        nx.draw_networkx_nodes(subgraph, path_pos, node_color='skyblue', node_size=300)
        nx.draw_networkx_labels(subgraph, path_pos, font_size=10, font_color='black')
        
        path_edges = list(zip(path, path[1:]))
        nx.draw_networkx_edges(G, pos, edgelist=path_edges, edge_color='blue', width=2.5)

        plt.title(f"Shortest Path from {source} to {destination}\n(Optimized for Distance)")
        plt.axis('off')
        
        # Save the plot to a BytesIO object
        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png')
        img_buffer.seek(0)
        plt.close()
        
        # Encode image to Base64
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')

        return jsonify({
            "path": path,
            "distance": distance,
            "time": total_time,
            "image": img_base64
        })

    except nx.NetworkXNoPath:
        return jsonify({"error": "No path found between the selected districts."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
