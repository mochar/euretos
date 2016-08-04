import uuid

from flask import session, render_template, request, jsonify

from app import app, euretos, randomcolor


random_color = randomcolor.RandomColor()


@app.route('/concepts', methods=['GET', 'POST'])
def concepts():
    chebis = request.form['metabolites'].splitlines()
    concepts = euretos.chebis_to_concepts(chebis, flatten=True)
    return jsonify({'concepts': concepts})


@app.route('/predicates', methods=['GET', 'POST'])
def predicates():
    triples = euretos.find_triples(request.json['concepts'])
    all_predicates = {}
    for triple in triples:
        if all_predicates.get(triple['id']) is None:
            t = {'name': triple['name'], 'id': triple['id'],
                'color': random_color.generate()[0]}
            all_predicates[t['id']] = t
    return jsonify({'predicates': triples, 
        'all': list(all_predicates.values())})
    

@app.route('/')
def home():
    new_user = False
    if not 'uid' in session:
        new_user = True
        session['uid'] = str(uuid.uuid4())
    return render_template('index.html', new_user=new_user)
