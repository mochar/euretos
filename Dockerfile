FROM ubuntu:16.04
RUN apt-get update -y && apt-get install -y software-properties-common
RUN add-apt-repository universe
RUN apt-get update -y && apt-get install -y python3 python3-pip
RUN pip3 install flask flask-script requests numpy
COPY . /app
WORKDIR /app
#ENTRYPOINT ["python"]
CMD ["python3", "manage.py", "runserver"]
