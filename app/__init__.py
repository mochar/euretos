from flask import Flask
from app.scripts.euretos import Euretos

app = Flask(__name__)
app.config.from_object('config')
euretos = Euretos(app.config['EURETOS_CONFIG'])

from app import views
