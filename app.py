from flask import Flask, jsonify, request
from flask_cors import CORS 
import mysql.connector
import config
import os

app = Flask(__name__)
CORS(app)

def obtener_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        user=os.getenv("DB_USER", "root"),
        password=config.DevelopmentConfig.SQLALCHEMY_DATABASE_URI.split("://")[1].split(":")[1].split("@")[0], # O puedes colocar directamente la contraseña
        database=os.getenv("DB_NAME", "cine")
    )

#  Obtener y crear películas 
@app.route('/api/eventos', methods=['GET', 'POST'])
def gestionar_eventos():
    if request.method == 'POST':
        data = request.json
        titulo = data.get('titulo')
        descripcion = data.get('descripcion')
        precio = data.get('precio')
        
        fecha = data.get('fecha')
        hora = data.get('hora')
        sala = data.get('sala')
        capacidad_maxima = data.get('capacidad_maxima', 50)
        
        conexion = obtener_db_connection() 
        cursor = conexion.cursor()
        try:
        
            cursor.execute(
                "INSERT INTO eventos (titulo, descripcion, precio) VALUES (%s, %s, %s)", 
                (titulo, descripcion, precio)
            )
            evento_id = cursor.lastrowid # Obtenemos el ID generado de la película
            
          
            if fecha and hora and sala:
                cursor.execute(
                    "INSERT INTO horarios (evento_id, fecha, hora, sala, capacidad_maxima, boletos_vendidos) VALUES (%s, %s, %s, %s, %s, 0)",
                    (evento_id, fecha, hora, sala, capacidad_maxima)
                )

            conexion.commit()
            return jsonify({"mensaje": "Película y función creada con éxito"}), 201
        except Exception as e:
            conexion.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()
    else:
        conexion = obtener_db_connection()
        cursor = conexion.cursor(dictionary=True)
        try:
            cursor.execute("SELECT id, titulo, descripcion, precio FROM eventos")
            peliculas = cursor.fetchall()
            return jsonify(peliculas)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()

# Actualizar  y eliminar una película por ID
@app.route('/api/eventos/<int:id>', methods=['PUT', 'DELETE'])
def modificar_pelicula(id):
    if request.method == 'PUT':
        data = request.json
        titulo = data.get('titulo')
        descripcion = data.get('descripcion')
        precio = data.get('precio')
        
        conexion = obtener_db_connection()
        cursor = conexion.cursor()
        try:
            cursor.execute(
                "UPDATE eventos SET titulo = %s, descripcion = %s, precio = %s WHERE id = %s",
                (titulo, descripcion, precio, id)
            )
            conexion.commit()
            return jsonify({"mensaje": "Película actualizada con éxito"})
        except Exception as e:
            conexion.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()
            
    elif request.method == 'DELETE':
        conexion = obtener_db_connection()
        cursor = conexion.cursor()
        try:
          
            cursor.execute("DELETE FROM horarios WHERE evento_id = %s", (id,))
         
            cursor.execute("DELETE FROM eventos WHERE id = %s", (id,))
            conexion.commit()
            return jsonify({"mensaje": "Película y sus funciones eliminadas con éxito"})
        except Exception as e:
            conexion.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            conexion.close()

#  Obtener los horarios/funciones de una película específica 
@app.route('/api/horarios/<int:evento_id>', methods=['GET'])
def get_horarios(evento_id):
    conexion = obtener_db_connection()
    cursor = conexion.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id, evento_id, fecha, hora, sala, capacidad_maxima, boletos_vendidos FROM horarios WHERE evento_id = %s", 
            (evento_id,)
        )
        horarios = cursor.fetchall()
        
        for h in horarios:
            if h.get('fecha'):
                h['fecha'] = h['fecha'].strftime('%Y-%m-%d')
                
        return jsonify(horarios)
    except Exception as e:
      
        return jsonify([])
    finally:
        cursor.close()
        conexion.close()

# Agregar un horario nuevo a una película existente (POST)
@app.route('/api/horarios', methods=['POST'])
def agregar_horario():
    data = request.json
    evento_id = data.get('evento_id')
    fecha = data.get('fecha')
    hora = data.get('hora')
    sala = data.get('sala')
    capacidad_maxima = data.get('capacidad_maxima', 50)
    
    conexion = obtener_db_connection()
    cursor = conexion.cursor()
    try:
        cursor.execute(
            "INSERT INTO horarios (evento_id, fecha, hora, sala, capacidad_maxima, boletos_vendidos) VALUES (%s, %s, %s, %s, %s, 0)",
            (evento_id, fecha, hora, sala, capacidad_maxima)
        )
        conexion.commit()
        return jsonify({"mensaje": "Horario agregado con éxito"}), 201
    except Exception as e:
        conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

#  Actualizar un horario existente por su ID (PUT)
@app.route('/api/horarios/<int:horario_id>', methods=['PUT'])
def actualizar_horario(horario_id):
    data = request.json
    fecha = data.get('fecha')
    hora = data.get('hora')
    sala = data.get('sala')
    capacidad_maxima = data.get('capacidad_maxima')
    
    conexion = obtener_db_connection()
    cursor = conexion.cursor()
    try:
        cursor.execute(
            "UPDATE horarios SET fecha = %s, hora = %s, sala = %s, capacidad_maxima = %s WHERE id = %s",
            (fecha, hora, sala, capacidad_maxima, horario_id)
        )
        conexion.commit()
        return jsonify({"mensaje": "Horario actualizado con éxito"})
    except Exception as e:
        conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

#  Registrar una reserva de boletos (POST)
@app.route('/api/reservas', methods=['POST'])
def crear_reserva():
    data = request.get_json()
    horario_id = data.get('horario_id')
    nombre_cliente = data.get('nombre_cliente')
    cantidad_boletos = int(data.get('cantidad_boletos', 1))

    conexion = obtener_db_connection()
    cursor = conexion.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT capacidad_maxima, boletos_vendidos FROM horarios WHERE id = %s", 
            (horario_id,)
        )
        horario = cursor.fetchone()
        
        if not horario:
            return jsonify({"error": "La función seleccionada no existe."}), 404

        disponibles = horario['capacidad_maxima'] - horario['boletos_vendidos']

        if cantidad_boletos > disponibles:
            return jsonify({"error": f"Lo sentimos, solo quedan {disponibles} boletos disponibles para esta función."}), 400

        cursor.execute(
            "UPDATE horarios SET boletos_vendidos = boletos_vendidos + %s WHERE id = %s",
            (cantidad_boletos, horario_id)
        )

        conexion.commit()
        return jsonify({"mensaje": "¡Boleto(s) reservado(s) y descontado(s) con éxito!"}), 201

    except Exception as e:
        conexion.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conexion.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)