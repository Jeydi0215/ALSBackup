import styles from '../css/Summary.module.css'

const Summary = () => {
    return(
        <div className={styles.Summary}>
            <div className={styles.Summary_top}>
                <select name="" id="">
                    <option value="This week">This Week</option>
                </select>

                <button>Export</button>
            </div>

            <table>
  <thead>
    <tr>

      <th>Date</th>
      <th>Clock In</th>
      <th>Clock Out</th>
      <th>Break Time</th>
      <th>Work Time</th>
    </tr>
  </thead>
  <tbody>
    <tr>

      <td>2025-05-05</td>
      <td>08:00 AM</td>
      <td>04:30 PM</td>
      <td>00:30</td>
      <td>08:00</td>
    </tr>
    <tr>

      <td>2025-05-06</td>
      <td>08:00 AM</td>
      <td>05:00 PM</td>
      <td>01:00</td>
      <td>08:00</td>
    </tr>
    <tr>

      <td>2025-05-07</td>
      <td>09:00 AM</td>
      <td>05:00 PM</td>
      <td>00:30</td>
      <td>07:30</td>
    </tr>
    <tr>

      <td>2025-05-08</td>
      <td>08:30 AM</td>
      <td>04:30 PM</td>
      <td>00:45</td>
      <td>07:15</td>
    </tr>
    <tr>

      <td>2025-05-09</td>
      <td>08:00 AM</td>
      <td>03:30 PM</td>
      <td>00:30</td>
      <td>07:00</td>
    </tr>
  </tbody>
            </table>

        </div>
    )
}

export default Summary;