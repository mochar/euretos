from collections import defaultdict
from pprint import pprint
import requests
import json
import configparser


class Euretos:
    def __init__(self, config_file='config.ini', api_key=None):
        config = configparser.ConfigParser()
        config.read(config_file)
        self.base_url = config['data']['url'] + '{}'
        self.s = requests.Session()
        self.s.headers.update(
            {'content-type': 'application/json; charset=UTF-8'})
        self.log_in(config['data']['username'], config['data']['password'], api_key)
        
    def _flatten_concepts(self, concepts):
        flattened_concepts = []
        for source_id, cs in concepts.items():
            # TODO
            # flattened_concept = {'name': cs[0]['name'], 
            #     'type': cs[0]['type'], 'sourceId': source_id, 
            #     'id': cs[0]['id']}
            # flattened_concepts.append(flattened_concept)
            for concept in cs:
                flattened_concept = {'name': concept['name'], 
                    'type': concept['type'], 'sourceId': source_id, 
                    'id': concept['id']}
                flattened_concepts.append(flattened_concept)
        return flattened_concepts
        
    def log_in(self, username, password, api_key=None):
        if api_key is None:
            data = {'username': username, 'password': password}
            url = self.base_url.format('/login/authenticate')
            r = self.s.post(url, data=json.dumps(data))
            api_key = r.json()['token']
        print(api_key)
        self.s.headers.update({'x-token': api_key})
    
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
            r = self.s.post(url, data=json.dumps(data), params={'size': chunk_size})
            concepts.extend(r.json()['content'])
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
        data = {
            'additionalFields': ['tripleIds'],
            'leftInputs': concepts,
            'rightInputs': concepts,
            'relationshipWeightAlgorithm': 'PWS', 
            'sort': 'ASC' 
        }
        r = self.s.post(url, data=json.dumps(data), params={'size': 9999})
        for x in r.json()['content']:
            if x['concepts'][0]['id'] == x['concepts'][1]['id']:
                continue
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
            # 'relationshipWeightAlgorithm': 'jis', 
            'relationshipWeightAlgorithm': 'pws', 
        }
        r = self.s.post(url, data=json.dumps(data))
        return r.json()['content']

    def find_go_concepts(self, go):
        """
        Molecular function = mf = go id 0003674 = concept id 243521
        Biologcal process = bp = go id 0008150 = concept id 2048467
        """
        if go not in ['mf', 'bp']: 
            raise Exception('GO term should be: mf OR bp')
        go_concept_id = {'mf': '243521', 'bp': '2048467'}[go]
        url = self.base_url.format('/external/concept-to-semantic/direct')
        data = {
            'leftInputs': [go_concept_id], 
            'relationshipWeightAlgorithm': 'PWS', 
            'rightInputs': ['sc:Physiology'], 
            'sort': 'ASC'
        }
        r = self.s.post(url, data=json.dumps(data), params={'size': 9999})
        return [connection['concepts'][1] for connection in r.json()['content']]
        
    def _find_go_concepts(self):
        pass

    def search_disorders(self, disorder):
        url = self.base_url.format('/external/concepts/search')
        query_string = 'term:\'{}\' AND semanticcategory:\'{}\''.format(disorder, 'Disorders')
        data = {'queryString': query_string, 'searchType': 'TOKEN'}
        r = self.s.post(url, data=json.dumps(data))
        return r.json()
        
    def find_connected(self, concepts, concept):
        url = self.base_url.format('/external/concept-to-concept/direct')
        data = {
            'additionalFields': ['predicateNames'],
            'leftInputs': concepts,
            'rightInputs': [concept],
            'relationshipWeightAlgorithm': 'PWS', 
            'sort': 'ASC' 
        }
        r = self.s.post(url, data=json.dumps(data))
        connections = []
        for connection in r.json()['content']:
            if 'is associated with' in connection['relationships'][0]['predicateNames']:
                connections.append(connection['concepts'][0]['id'])
        return connections

    def find_inhibitors(self, concept):
        url = self.base_url.format('/external/direct-connections-with-scores')
        data = {
            'additionalFields': ['predicates'],
            'ids': [concept],
            'relationshipWeightAlgorithm': 'pws', 
            'sort': 'ASC' 
        }
        r = self.s.post(url, data=json.dumps(data))
        return r.json()['content']