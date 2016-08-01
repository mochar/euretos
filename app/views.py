import uuid

from flask import session, render_template, request, jsonify

from app import app, euretos


@app.route('/concepts', methods=['GET', 'POST'])
def concepts():
    chebis = request.form['metabolites'].splitlines()
    concepts = euretos.chebis_to_concepts(chebis, flatten=True)
    return jsonify({'concepts': concepts})


@app.route('/predicates', methods=['GET', 'POST'])
def predicates():
    triples = euretos.find_triples(request.json['concepts'])
    return jsonify({'predicates': triples})
    

@app.route('/')
def home():
    new_user = False
    if not 'uid' in session:
        new_user = True
        session['uid'] = str(uuid.uuid4())
    return render_template('index.html', new_user=new_user)
