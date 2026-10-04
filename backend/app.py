@app.route('/check', methods=['POST'])
def check_railway():
    data = request.json
    lat = data.get('latitude')
    lng = data.get('longitude')
    
    response = supabase.rpc('check_railway_proximity', {
        'user_lat': lat,
        'user_lng': lng,
        'radius_meters': 150.0
    }).execute()
    
    is_railway = len(response.data) > 0
    return jsonify({
        'isTrainJourney': is_railway,
        'feature': response.data[0] if is_railway else None
    })
