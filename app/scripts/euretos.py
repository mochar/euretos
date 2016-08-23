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
        for source_id, cs in concepts.items():
            # TODO
            flattened_concept = {'name': cs[0]['name'], 
                'type': cs[0]['type'], 'sourceId': source_id, 
                'id': cs[0]['id']}
            flattened_concepts.append(flattened_concept)
        return flattened_concepts
        
    def log_in(self, username, password):
        data = {'username': username, 'password': password}
        url = self.base_url.format('/login/authenticate')
        r = self.s.post(url, data=json.dumps(data))
        print(r.json()['token'])
        self.s.headers.update({'x-token': r.json()['token']})
    
    def search_for_concepts(self, terms, chunk_size=150):
        url = self.base_url.format('/external/concepts/search')
        concepts = []
        for pos in range(0, len(terms), chunk_size):
            chunk_terms = terms[pos:pos + chunk_size]
            query_string = ' OR '.join('term:\'{}\''.format(term) for term in chunk_terms)
            data = {
                'queryString': query_string,
                'searchType': 'TOKEN',
                'additionalFields': ['synonyms']
            }
            r = self.s.post(url, data=json.dumps(data))
            concepts.extend(r.json())
        return concepts
        
    def ids_to_concepts(self, ids, prefix, type_, flatten):
        concepts = self.search_for_concepts(ids)
        mapped_concepts = defaultdict(list)
        for concept in concepts:
            concept['type'] = type_
            for synonym in concept['synonyms']:
                if not synonym['name'].startswith(prefix):
                    continue
                _, id_ = synonym['name'].split(prefix)
                del concept['synonyms']
                mapped_concepts[id_].append(concept)
                break
        return self._flatten_concepts(mapped_concepts) if flatten else mapped_concepts
        
    def chebis_to_concepts(self, chebis, flatten=True):
        chebis = ['CHEBI:{}'.format(chebi) for chebi in chebis]
        return self.ids_to_concepts(chebis, '[chebi]', 'metabolite', flatten)
        
    def entrez_to_concepts(self, entrez_ids, flatten=True):
        entrez_ids = ['[entrezgene]{}'.format(entrez) for entrez in entrez_ids]
        return self.ids_to_concepts(entrez_ids, '[entrezgene]', 'gene', flatten)
        
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
        triples = []
        for triple in r.json():
            triples.append({
                'id': triple['predicateId'],
                'name': triple['predicateName'],
                'tripleId': triple['id'],
                'source': triple['subjectId'],
                'target': triple['objectId'],
                'publicationCount': len(triple['publicationIds'])
            })
        return triples

    def find_direct_connections(self, concept_ids):
        url = self.base_url.format('/external/direct-connections-with-scores')
        data = {
            'ids': concept_ids,
            'relationshipWeightAlgorithm': 'pws', 
        }
        r = self.s.post(url, data=json.dumps(data))
        return r.json()['content']

    def find_go_concepts(self, go):
        """
        TODO: pagination in Euretos
        Molecular function = mf = go id 322870
        Biologcal process = bp = go id 1669558
        """
        if go not in ['mf', 'bp']: 
            raise Exception('GO term should be: mf OR bp')
        go_concept_id = {'mf': '322870', 'bp': '1669558'}[go]
        url = self.base_url.format('/external/concept-to-semantic/direct')
        data = {
            'leftInputs': [go_concept_id], 
            'relationshipWeightAlgorithm': 'PWS', 
            'rightInputs': ['sc:Physiology'], 
            'sort': 'ASC'
        }
        r = self.s.post(url, data=json.dumps(data))
        return [connection['concepts'][1] for connection in r.json()['content']]
