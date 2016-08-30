import uuid

from flask import session, render_template, request, jsonify

from app import app, euretos, randomcolor
from app.scripts.enrichment import Enrichment


random_color = randomcolor.RandomColor()


def find_triples(concepts):
    triples = euretos.find_triples(concepts)
    all_predicates = {}
    colors = random_color.generate(count=len(triples), luminosity='dark')
    for i, triple in enumerate(triples):
        if all_predicates.get(triple['id']) is None:
            t = {'name': triple['name'], 'id': triple['id'],
                 'color': colors[i]}
            all_predicates[t['id']] = t
            triple['color'] = t['color']
        else:
            triple['color'] = all_predicates[triple['id']]['color']
    return triples, list(all_predicates.values())


@app.route('/concepts', methods=['GET', 'POST'])
def concepts():
    metabolites = request.form['metabolites'].splitlines()
    genes = request.form['genes'].splitlines()
    concepts_ = euretos.chebis_to_concepts(metabolites, flatten=True)
    concepts_.extend(euretos.entrez_to_concepts(genes, flatten=True))
    triples, all_predicates = find_triples([c['id'] for c in concepts_])
    return jsonify({'concepts': concepts_, 'predicates': triples,
        'all': all_predicates})


@app.route('/enrichment', methods=['GET', 'POST'])
def enrichment():
    concepts_ = request.form.getlist('concepts[]')
    en = Enrichment(euretos, concepts_, request.form['go'])
    return jsonify({'gos': en.sorted_concepts})


@app.route('/disorders')
def disorders():
    disorder_concepts = euretos.search_disorders(request.args['term'])
    return jsonify({'concepts': disorder_concepts})


@app.route('/connected', methods=['GET', 'POST'])
def connected():
    concepts_ = request.form.getlist('concepts[]')
    connected_ = euretos.find_connected(concepts_, request.form['concept'])
    return jsonify({'connected': connected_})


@app.route('/')
def home():
    new_user = False
    if not 'uid' in session:
        new_user = True
        session['uid'] = str(uuid.uuid4())
    return render_template('index.html', new_user=new_user)
