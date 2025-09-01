document.addEventListener('DOMContentLoaded', async () => { 
    const sourceSelect = document.getElementById('source-select');
    const destinationSelect = document.getElementById('destination-select');
    const findRouteBtn = document.getElementById('find-route-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultContainer = document.getElementById('result-container');
    const errorMessage = document.getElementById('error-message');
    const pathOutput = document.getElementById('path-output');
    const distanceOutput = document.getElementById('distance-output');
    const timeOutput = document.getElementById('time-output');
    const canvas = document.getElementById('route-map');

    let graph = {};
    let coordinates = {};
    let allDistricts = new Set();
    let myChart = null;

    async function loadData() {
        try {
            const response = await fetch('tn_distance.csv');
            const csvText = await response.text();
            
            const lines = csvText.trim().split(/\r?\n/);
            lines.slice(1).forEach(line => {
                const [src, dest, dist, time, lat_src, lon_src, lat_dest, lon_dest] = line.split(",");

                allDistricts.add(src);
                allDistricts.add(dest);

                if (!graph[src]) graph[src] = [];
                if (!graph[dest]) graph[dest] = [];
                graph[src].push({ node: dest, dist: parseFloat(dist), time: parseFloat(time) });
                graph[dest].push({ node: src, dist: parseFloat(dist), time: parseFloat(time) });

                // Store coordinates only if not already saved
                if (!coordinates[src]) {
                    coordinates[src] = { x: parseFloat(lon_src), y: parseFloat(lat_src) };
                }
                if (!coordinates[dest]) {
                    coordinates[dest] = { x: parseFloat(lon_dest), y: parseFloat(lat_dest) };
                }
            });

            const sortedDistricts = Array.from(allDistricts).sort();
            sortedDistricts.forEach(district => {
                const option1 = document.createElement('option');
                option1.value = district;
                option1.textContent = district;
                sourceSelect.appendChild(option1);

                const option2 = document.createElement('option');
                option2.value = district;
                option2.textContent = district;
                destinationSelect.appendChild(option2);
            });

            console.log("Data loaded successfully.");
        } catch (error) {
            console.error('Error loading data:', error);
            errorMessage.textContent = 'Could not load data file. Please ensure tn_distance.csv is in the same directory.';
            errorMessage.classList.remove('hidden');
        }
    }

    function dijkstra(source, target) {
        const distances = {};
        const times = {};
        const prev = {};
        const unvisited = new Set(Object.keys(graph));

        // initialize distances
        Object.keys(graph).forEach(node => {
            distances[node] = Infinity;
            times[node] = Infinity;
        });
        distances[source] = 0;
        times[source] = 0;

        while (unvisited.size > 0) {
            let minNode = null;
            unvisited.forEach(node => {
                if (minNode === null || distances[node] < distances[minNode]) {
                    minNode = node;
                }
            });

            if (minNode === target) break;
            if (distances[minNode] === Infinity) break;

            unvisited.delete(minNode);

            graph[minNode].forEach(neighbor => {
                const newDist = distances[minNode] + neighbor.dist;
                const newTime = times[minNode] + neighbor.time;
                if (newDist < distances[neighbor.node]) {
                    distances[neighbor.node] = newDist;
                    times[neighbor.node] = newTime;
                    prev[neighbor.node] = minNode;
                }
            });
        }

        if (distances[target] === Infinity) {
            return { path: null, distance: Infinity, time: Infinity };
        }

        const path = [];
        let u = target;
        while (u !== undefined) {
            path.unshift(u);
            u = prev[u];
        }

        return { path, distance: distances[target], time: times[target] };
    }

    function createChart(path) {
        if (myChart) {
            myChart.destroy();
        }

        const pathData = path.map(district => coordinates[district]);
        const allPoints = Array.from(allDistricts).map(district => ({
            x: coordinates[district].x,
            y: coordinates[district].y,
            label: district
        }));

        const data = {
            datasets: [
                {
                    label: 'All Districts',
                    data: allPoints,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    showLine: false,
                },
                {
                    label: 'Shortest Path',
                    data: pathData,
                    borderColor: 'rgb(37, 99, 235)',
                    borderWidth: 3,
                    fill: false,
                    pointRadius: 6,
                    pointBackgroundColor: 'rgb(239, 68, 68)',
                    pointBorderColor: 'white',
                    pointBorderWidth: 2,
                    showLine: true,
                }
            ]
        };

        const config = {
            type: 'scatter',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.data[context.dataIndex].label || '';
                            }
                        }
                    },
                    legend: { display: false }
                },
                scales: {
                    x: { type: 'linear', display: false },
                    y: { type: 'linear', display: false }
                }
            }
        };

        myChart = new Chart(canvas, config);
    }

    findRouteBtn.addEventListener('click', () => {
        const source = sourceSelect.value;
        const destination = destinationSelect.value;

        resultContainer.classList.add('hidden');
        errorMessage.classList.add('hidden');
        
        if (!source || !destination || source === destination) {
            errorMessage.textContent = 'Please select a valid source and destination district.';
            errorMessage.classList.remove('hidden');
            return;
        }

        loadingSpinner.classList.remove('hidden');

        try {
            const result = dijkstra(source, destination);
            if (!result.path || result.distance === Infinity) {
                throw new Error("No path found between districts.");
            }

            pathOutput.textContent = result.path.join(' → ');
            distanceOutput.textContent = `Total Distance: ${result.distance.toFixed(2)} km`;
            timeOutput.textContent = `Estimated Time: ${result.time.toFixed(2)} hours`;

            createChart(result.path);
            resultContainer.classList.remove('hidden');
        } catch (error) {
            console.error('Error finding route:', error);
            errorMessage.textContent = `An error occurred: ${error.message}`;
            errorMessage.classList.remove('hidden');
        } finally {
            loadingSpinner.classList.add('hidden');
        }
    });

    loadData();
});
