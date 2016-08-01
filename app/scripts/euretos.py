from collections import defaultdict
from pprint import pprint
import requests
import json
import configparser


class Euretos:
    def __init__(self, config_file='config.ini'):
        config = configparser.ConfigParser()
        config.read(config_file)
        self.base_url = config['data']['url'] + '{}'
        self.s = requests.Session()
        self.s.headers.update(
            {'content-type': 'application/json; charset=UTF-8'})
        self.log_in(config['data']['username'], config['data']['password'])
        
    def _flatten_concepts(self, concepts):
        flattened_concepts = []
        for chebi_id, cs in concepts.items():
            # TODO
            flattened_concept = {'name': cs[0]['name'],
                'chebi_id': chebi_id, 'id': cs[0]['id']}
            flattened_concepts.append(flattened_concept)
        return flattened_concepts
        
    def log_in(self, username, password):
        data = {'username': username, 'password': password}
        url = self.base_url.format('/login/authenticate')
        r = self.s.post(url, data=json.dumps(data))
        print(r.json()['token'])
        self.s.headers.update({'x-token': r.json()['token']})
    
    def search_for_concepts(self, terms):
        url = self.base_url.format('/external/concepts/search')
        query_string = ' OR '.join('term:\'{}\''.format(term) for term in terms)
        data = {
            'queryString': query_string,
            'searchType': 'TOKEN',
            'additionalFields': ['synonyms']
        }
        r = self.s.post(url, data=json.dumps(data))
        return r.json()
        
    def chebis_to_concepts(self, chebis, flatten=True):
        chebis = ['CHEBI:{}'.format(chebi) for chebi in chebis]
        concepts = self.search_for_concepts(chebis)
        mapped_concepts = defaultdict(list)
        for concept in concepts:
            for synonym in concept['synonyms']:
                if not synonym['name'].startswith('[chebi]'):
                    continue
                _, chebi = synonym['name'].split('[chebi]')
                del concept['synonyms']
                mapped_concepts[chebi].append(concept)
                break
        return self._flatten_concepts(mapped_concepts) if flatten else mapped_concepts
        
    def _find_triple_ids(self, concepts):
        url = self.base_url.format('/external/concept-to-concept/direct')
        triple_ids = set()
        for concept in concepts:
            other_concepts = [c for c in concepts if c != concept]
            data = {
                'additionalFields': ['tripleIds'],
                'leftInputs': [concept],
                'rightInputs': other_concepts,
                'relationshipWeightAlgorithm': 'PWS', 
                'sort': 'ASC' 
            }
            r = self.s.post(url, data=json.dumps(data))
            for x in r.json()['content']:
                for relationship in x['relationships']:
                    triple_ids.update(relationship['tripleIds'])
        return list(triple_ids)
        
    def find_triples(self, concepts):
        triple_ids = self._find_triple_ids(concepts)
        url = self.base_url.format('/external/triples')
        data = {
            'additionalFields': ['publicationIds', 'predicateName'],
            'ids': triple_ids
        }
        r = self.s.post(url, data=json.dumps(data))
        # triples = defaultdict(list)
        triples = []
        for triple in r.json():
            # triples[triple['predicateId']].append({
            triples.append({
                'id': triple['predicateId'],
                'name': triple['predicateName'],
                'tripleId': triple['id'],
                'source': triple['subjectId'],
                'target': triple['objectId'],
                'publicationCount': len(triple['publicationIds'])
            })
        return triples
